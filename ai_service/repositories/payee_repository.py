from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Payee


# India-appropriate predefined payees (see ai_service/repositories/category_repository.py
# for the matching category list). Split by transaction type per the payee/type distinction.
PREDEFINED_PAYEES = (
    # expense — common merchants/services
    ("Amazon", "expense"),
    ("Flipkart", "expense"),
    ("DMart", "expense"),
    ("Big Bazaar", "expense"),
    ("Swiggy", "expense"),
    ("Zomato", "expense"),
    ("Starbucks", "expense"),
    ("Uber", "expense"),
    ("Ola", "expense"),
    ("Netflix", "expense"),
    ("Spotify", "expense"),
    ("Apple", "expense"),
    ("Google", "expense"),
    ("Local Grocery Store", "expense"),
    ("Pharmacy", "expense"),
    ("Restaurant", "expense"),
    ("Landlord", "expense"),
    ("Electricity Board", "expense"),
    ("Internet Provider", "expense"),
    ("Petrol Pump", "expense"),
    # income — common sources
    ("Employer", "income"),
    ("Salary", "income"),
    ("Freelance Client", "income"),
    ("Consulting Client", "income"),
    ("Business", "income"),
    ("Rental Income", "income"),
    ("Investment", "income"),
    ("Dividend", "income"),
    ("Interest", "income"),
    ("Bonus", "income"),
    ("Commission", "income"),
    ("Scholarship", "income"),
    ("Stipend", "income"),
    ("Refund", "income"),
    ("Government Benefit", "income"),
    ("Other Income", "income"),
)


class PayeeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, name: str, type: str) -> Payee:
        clean_name = name.strip()
        payee = Payee(user_id=user_id, name=clean_name, normalized_name=clean_name.lower(), type=type)
        self.session.add(payee)
        await self.session.flush()
        return payee

    async def list(self, user_id: uuid.UUID, *, type: str | None = None) -> list[Payee]:
        stmt = select(Payee).where(Payee.user_id == user_id)
        if type is not None:
            stmt = stmt.where(Payee.type == type)
        result = await self.session.scalars(stmt.order_by(Payee.name, Payee.id))
        return list(result)

    async def get(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> Payee | None:
        return await self.session.scalar(
            select(Payee).where(Payee.user_id == user_id, Payee.id == payee_id)
        )

    async def update(self, user_id: uuid.UUID, payee_id: uuid.UUID, name: str) -> Payee | None:
        payee = await self.get(user_id, payee_id)
        if payee is None:
            return None
        clean_name = name.strip()
        payee.name = clean_name
        payee.normalized_name = clean_name.lower()
        await self.session.flush()
        # Reload the server-updated updated_at (a lazy load later would raise MissingGreenlet).
        await self.session.refresh(payee)
        return payee

    async def delete(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> bool:
        payee = await self.get(user_id, payee_id)
        if payee is None:
            return False
        await self.session.delete(payee)
        await self.session.flush()
        return True

    async def find_or_create(self, user_id: uuid.UUID, name: str, type: str) -> Payee:
        normalized_name = name.strip().lower()
        existing = await self.session.scalar(
            select(Payee).where(
                Payee.user_id == user_id,
                Payee.normalized_name == normalized_name,
                Payee.type == type,
            )
        )
        if existing is not None:
            return existing
        try:
            async with self.session.begin_nested():
                payee = Payee(
                    user_id=user_id,
                    name=name.strip(),
                    normalized_name=normalized_name,
                    type=type,
                )
                self.session.add(payee)
                await self.session.flush()
            return payee
        except IntegrityError:
            return await self.session.scalar(
                select(Payee).where(
                    Payee.user_id == user_id,
                    Payee.normalized_name == normalized_name,
                    Payee.type == type,
                )
            )

    async def seed_defaults(self, user_id: uuid.UUID) -> list[Payee]:
        existing = await self.list(user_id)
        existing_keys = {(item.normalized_name, item.type) for item in existing}
        created: list[Payee] = []
        for name, payee_type in PREDEFINED_PAYEES:
            if (name.strip().lower(), payee_type) in existing_keys:
                continue
            created.append(await self.create(user_id, name=name, type=payee_type))
        return created
