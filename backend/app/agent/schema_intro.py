"""Schema introspection to build agent prompts."""

from enum import Enum
from typing import get_args, get_origin

from pydantic.fields import FieldInfo

from app.schemas.property import PropertyCreate

_EXCLUDED_FIELDS = {"is_featured", "image_urls", "image_alt", "status"}


def build_seller_fields_prompt() -> str:
    """Builds a human-readable comma-separated list of fields required for selling."""
    fields = []
    
    for field_name, field_info in PropertyCreate.model_fields.items():
        if field_name in _EXCLUDED_FIELDS:
            continue
            
        annotation = field_info.annotation
        
        # Unwrap Optional types (e.g. Type | None or Optional[Type])
        if get_origin(annotation) is not None:
            args = [arg for arg in get_args(annotation) if arg is not type(None)]
            if args:
                annotation = args[0]
                
        label = field_name.replace("_", " ")
        
        if field_name == "land_size_perches":
            label = "land size, in perches"
        elif field_name == "floor_area_sqft":
            label = "floor area, in square feet"
        elif field_name == "road_access_ft":
            label = "road access width, in feet"
        elif field_name == "is_price_per_perch":
            label = "whether the price is per-perch or for the whole property"
        elif field_name == "amenities":
            label = "amenities (any extra features or facilities)"
            
        if isinstance(annotation, type) and issubclass(annotation, Enum):
            options = ", ".join(e.value for e in annotation)
            label = f"{label} ({options})"
            
        fields.append(label)
        
    return ", ".join(fields)
