"""Shared test configuration: isolated state and signed bearer tokens."""

import os

# Must be set before the app is imported so tests never read or write real state files.
os.environ["CRISISROUTE_PERSIST_STATE"] = "false"
os.environ["CRISISROUTE_JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256-use"
os.environ["CRISISROUTE_ENVIRONMENT"] = "development"
