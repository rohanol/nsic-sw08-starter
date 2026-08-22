from spacepackets.ecss import PusTelemetry
import json

def generate_ccsds_packet(stats_dict, safe_zones):
    """
    Takes the JSON telemetry and packs it into a binary CCSDS Space Packet
    mimicking NASA's PUS (Packet Utilization Standard).
    """
    # Create the payload as bytes
    payload_data = json.dumps({"s": stats_dict, "z": safe_zones}).encode('utf-8')
    
    # Create a CCSDS PUS Telemetry Packet (Service 3: Housekeeping & Diagnostics)
    # APID (Application Process Identifier) is unique to our landing subsystem
    tm_packet = PusTelemetry(
        service=3,
        subservice=25,
        apid=0x1A, 
        source_data=payload_data
    )
    
    return tm_packet.pack()
