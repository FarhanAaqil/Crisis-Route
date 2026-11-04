"""Hazard event footprints and spatial intensity models for CrisisBench-mini."""

import math
from dataclasses import dataclass


@dataclass
class DisasterEvent:
    """Disaster event definition with spatial epicenter and hazard parameters."""

    event_id: int
    name: str
    region_name: str
    hazard_type: str  # flood, landslide, cyclone, embankment_breach
    epicenter: tuple[float, float]  # (lon, lat)
    radius_km: float
    peak_intensity: float  # [0.0, 1.0]
    decay_rate: float
    split_assignment: str  # train, val, test


DISASTER_EVENTS: list[DisasterEvent] = [
    # Train Events (1 through 8) - Kerala Corridors
    DisasterEvent(
        event_id=1,
        name="Wayanad Monsoon Flash Flood A",
        region_name="Kerala-Wayanad",
        hazard_type="flash_flood",
        epicenter=(76.128, 11.551),
        radius_km=18.0,
        peak_intensity=0.95,
        decay_rate=0.08,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=2,
        name="Chooralmala Valley Debris Flow",
        region_name="Kerala-Wayanad",
        hazard_type="landslide",
        epicenter=(76.170, 11.535),
        radius_km=14.0,
        peak_intensity=0.90,
        decay_rate=0.10,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=3,
        name="Vythiri Hillcrest Inundation",
        region_name="Kerala-Wayanad",
        hazard_type="landslide",
        epicenter=(76.041, 11.552),
        radius_km=16.0,
        peak_intensity=0.85,
        decay_rate=0.07,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=4,
        name="Panamaram River Basin Surge",
        region_name="Kerala-Wayanad",
        hazard_type="flood",
        epicenter=(76.071, 11.724),
        radius_km=22.0,
        peak_intensity=0.88,
        decay_rate=0.06,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=5,
        name="Mananthavady North Overflow",
        region_name="Kerala-Wayanad",
        hazard_type="flood",
        epicenter=(76.003, 11.803),
        radius_km=20.0,
        peak_intensity=0.82,
        decay_rate=0.07,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=6,
        name="Kalpetta Trunk Corridor Cutoff",
        region_name="Kerala-Wayanad",
        hazard_type="landslide",
        epicenter=(76.082, 11.608),
        radius_km=15.0,
        peak_intensity=0.89,
        decay_rate=0.09,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=7,
        name="Periyar River Lower Basin Overflow",
        region_name="Kerala-Periyar",
        hazard_type="flood",
        epicenter=(76.320, 10.050),
        radius_km=25.0,
        peak_intensity=0.86,
        decay_rate=0.05,
        split_assignment="train",
    ),
    DisasterEvent(
        event_id=8,
        name="Aluva Gateway Flood Surge",
        region_name="Kerala-Periyar",
        hazard_type="flood",
        epicenter=(76.350, 10.110),
        radius_km=22.0,
        peak_intensity=0.84,
        decay_rate=0.06,
        split_assignment="train",
    ),
    # Validation / Calibration Events (9 and 10) - Assam Flood Basin
    DisasterEvent(
        event_id=9,
        name="Silchar Barak River Breach",
        region_name="Assam-Barak",
        hazard_type="embankment_breach",
        epicenter=(92.795, 24.825),
        radius_km=28.0,
        peak_intensity=0.92,
        decay_rate=0.05,
        split_assignment="val",
    ),
    DisasterEvent(
        event_id=10,
        name="Cachar Plains Prolonged Inundation",
        region_name="Assam-Barak",
        hazard_type="flood",
        epicenter=(92.880, 24.890),
        radius_km=30.0,
        peak_intensity=0.87,
        decay_rate=0.04,
        split_assignment="val",
    ),
    # Test Events (11 and 12) - Odisha Cyclone & Storm Surge
    DisasterEvent(
        event_id=11,
        name="Puri Coastal Cyclone Inundation",
        region_name="Odisha-Puri",
        hazard_type="cyclone",
        epicenter=(85.831, 19.813),
        radius_km=35.0,
        peak_intensity=0.96,
        decay_rate=0.04,
        split_assignment="test",
    ),
    DisasterEvent(
        event_id=12,
        name="Mahanadi Delta Storm Surge",
        region_name="Odisha-Puri",
        hazard_type="cyclone",
        epicenter=(85.950, 20.010),
        radius_km=32.0,
        peak_intensity=0.91,
        decay_rate=0.05,
        split_assignment="test",
    ),
]


def haversine_distance_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculate great-circle distance in kilometers."""
    radius_earth_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_earth_km * c


def compute_hazard_intensity(lon: float, lat: float, event: DisasterEvent) -> float:
    """Calculate continuous hazard intensity [0.0, 1.0] at a geographic coordinate."""
    dist_km = haversine_distance_km(lon, lat, event.epicenter[0], event.epicenter[1])
    if dist_km > event.radius_km:
        return 0.0

    # Gaussian / exponential spatial decay
    intensity = event.peak_intensity * math.exp(-event.decay_rate * dist_km)
    return max(0.0, min(1.0, intensity))


def get_event_by_id(event_id: int) -> DisasterEvent:
    """Look up disaster event specification by ID."""
    for ev in DISASTER_EVENTS:
        if ev.event_id == event_id:
            return ev
    raise KeyError(f"Event ID {event_id} not found in CrisisBench catalog")
