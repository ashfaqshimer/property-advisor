from pydantic import BaseModel, Field


class IkmanCategory(BaseModel):
    name: str | None = None
    slug: str | None = None


class IkmanLocation(BaseModel):
    name: str | None = None


class IkmanContactCard(BaseModel):
    name: str | None = None
    phoneNumbers: list[dict[str, str | bool]] = Field(default_factory=list)


class IkmanAd(BaseModel):
    id: str
    title: str | None = None
    slug: str | None = None
    price: str | None = None
    category: IkmanCategory | None = None
    location: str | IkmanLocation | None = None
    adType: str | None = None
    isMember: bool = False
    isAuthDealer: bool = False
    membershipLevel: str = "free"
    shopName: str | None = None
    isVerified: bool = False


class IkmanAdDetail(IkmanAd):
    description: str | None = None
    contactCard: IkmanContactCard | None = None
