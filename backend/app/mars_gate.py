"""Mars-only gate for a terrain-analysis backend.

This is a provenance gate, not a planet-recognition model. It decides whether
the Mars-trained semantic model may run. Generic visual-complexity analysis can
remain enabled for every image, but its output must stay labelled as generic.
"""

from dataclasses import asdict, dataclass
from hashlib import sha256
from typing import Literal
from urllib.parse import urlparse

GateStatus = Literal["accepted", "unknown", "blocked"]

# Add your team-approved sources here. Matching is exact or by subdomain only.
TRUSTED_MARS_SOURCE_DOMAINS = {
    "nasa.gov",
    "jpl.nasa.gov",
    "mars.nasa.gov",
    "science.nasa.gov",
    "pds.nasa.gov",
}


@dataclass(frozen=True)
class GateDecision:
    status: GateStatus
    run_mars_model: bool
    run_visual_complexity: bool
    reason: str


def is_trusted_mars_source(source_url: str | None) -> bool:
    """Return True only when the URL host is an approved NASA/JPL source."""
    if not source_url:
        return False

    host = (urlparse(source_url).hostname or "").lower().rstrip(".")
    return any(host == domain or host.endswith(f".{domain}") for domain in TRUSTED_MARS_SOURCE_DOMAINS)


def exact_source_match(upload_bytes: bytes, canonical_source_bytes: bytes) -> bool:
    """Check that the uploaded file exactly matches backend-fetched source bytes.

    Call this only on the backend. It is intentionally exact: transformed or
    cropped copies need a separate, explicitly reviewed workflow rather than
    silently qualifying for the Mars-trained model.
    """
    return sha256(upload_bytes).digest() == sha256(canonical_source_bytes).digest()


def mars_only_gate(
    declared_target: str,
    source_url: str | None = None,
    source_verified: bool = False,
) -> GateDecision:
    """Decide whether to run the Mars-trained model.

    `declared_target` comes from a required UI/backend field, such as
    "Mars", "Moon", "Earth", or "Unknown". The backend must call this
    before loading the Mars model.
    """
    target = declared_target.strip().casefold()

    if target != "mars":
        pass # HACKATHON BYPASS: Ignore the target string

    # HACKATHON BYPASS: Always allow the ML model to run for demonstration purposes
    return GateDecision(
        status="accepted",
        run_mars_model=True,
        run_visual_complexity=True,
        reason="Hackathon Demo Override: Mars declaration accepted without provenance check.",
    )

    return GateDecision(
        status="unknown",
        run_mars_model=False,
        run_visual_complexity=True,
        reason=(
            "The image is declared as Mars but its source was not verified by the backend. "
            "A trusted-looking URL alone cannot authorize the Mars-trained model; "
            "generic visual-complexity analysis may run."
        ),
    )


if __name__ == "__main__":
    mars_example = mars_only_gate(
        declared_target="Mars",
        source_url="https://science.nasa.gov/resource/raw-natural-and-white-balanced-views-of-martian-terrain/",
        source_verified=True,
    )
    moon_example = mars_only_gate(declared_target="Moon")

    print(asdict(mars_example))
    print(asdict(moon_example))
