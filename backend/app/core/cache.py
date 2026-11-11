"""Small thread-safe LRU cache for expensive, state-keyed computations."""

from collections import OrderedDict
from collections.abc import Callable, Hashable
from threading import RLock


class ResponseCache[V]:
    """Cache results by an explicit state key.

    Keys embed everything the result depends on (scenario snapshot, observation count, active
    plan), so a change in any of them produces a new key and stale entries simply age out.
    """

    def __init__(self, max_items: int = 128) -> None:
        self._max = max_items
        self._items: OrderedDict[Hashable, V] = OrderedDict()
        self._lock = RLock()
        self.hits = 0
        self.misses = 0

    def get_or_compute(self, key: Hashable, compute: Callable[[], V]) -> V:
        with self._lock:
            if key in self._items:
                self._items.move_to_end(key)
                self.hits += 1
                return self._items[key]
        value = compute()  # outside the lock: computations can take seconds
        with self._lock:
            self.misses += 1
            self._items[key] = value
            self._items.move_to_end(key)
            while len(self._items) > self._max:
                self._items.popitem(last=False)
        return value

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
