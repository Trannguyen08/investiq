"""AI Financial Assistant API Endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import authenticated_user_id, optional_user_id
from app.api.v1.market_data import get_market_provider
from app.application.use_cases.ai_chat.ai_financial_service import AiFinancialService
from app.application.use_cases.market_data.market_service import MarketService
from app.infrastructure.db.repositories.sql_ai_chat_repository import SqlAiChatRepository
from app.infrastructure.db.session import get_pool
from app.schemas.ai_chat import (
    AiChatRequest,
    AiChatResponse,
    AiConversationResponse,
    AiMessageResponse,
    CreateConversationRequest,
)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-assistant"])


def _ai_service() -> AiFinancialService:
    provider = get_market_provider()
    return AiFinancialService(MarketService(provider))


def _chat_repo() -> SqlAiChatRepository:
    return SqlAiChatRepository(get_pool())


@router.post("/chat", response_model=AiChatResponse)
async def chat_with_ai(
    request: AiChatRequest,
    ai_service: Annotated[AiFinancialService, Depends(_ai_service)],
    chat_repo: Annotated[SqlAiChatRepository, Depends(_chat_repo)],
    user_id: Annotated[str | None, Depends(optional_user_id)] = None,
) -> AiChatResponse:
    """Send a user message, process with financial context & widgets, save if logged in."""
    # Process with internal financial engine & data RAG
    ai_result = await ai_service.process_chat(request.message)

    conversation_id = request.conversation_id
    msg_id = str(uuid4())
    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    # If user is authenticated, persist to database
    if user_id:
        if conversation_id:
            conv = chat_repo.get_conversation(conversation_id, user_id)
            if not conv:
                conv = chat_repo.create_conversation(user_id, title=request.message[:60])
                conversation_id = conv["id"]
        else:
            conv = chat_repo.create_conversation(user_id, title=request.message[:60])
            conversation_id = conv["id"]

        # Save user message
        chat_repo.add_message(conversation_id, role="user", content=request.message)

        # Save assistant message
        saved_assistant = chat_repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=ai_result["content"],
            widgets=ai_result["widgets"],
            suggested_actions=ai_result["suggested_actions"],
        )
        msg_id = saved_assistant["id"]
        now_iso = saved_assistant["created_at"]
    else:
        # Ephemeral session for non-logged-in user
        if not conversation_id:
            conversation_id = f"guest-{uuid4()}"

    message_response = AiMessageResponse(
        id=msg_id,
        conversation_id=conversation_id,
        role="assistant",
        content=ai_result["content"],
        widgets=ai_result["widgets"],
        suggested_actions=ai_result["suggested_actions"],
        created_at=now_iso,
    )

    return AiChatResponse(
        conversation_id=conversation_id,
        message=message_response,
    )


@router.get("/conversations", response_model=list[AiConversationResponse])
def list_conversations(
    user_id: Annotated[str, Depends(authenticated_user_id)],
    chat_repo: Annotated[SqlAiChatRepository, Depends(_chat_repo)],
) -> list[AiConversationResponse]:
    """Get all saved chat conversations for the current logged in user."""
    rows = chat_repo.list_conversations(user_id, limit=50)
    return [
        AiConversationResponse(
            id=r["id"],
            title=r["title"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            message_count=r.get("message_count", 0),
        )
        for r in rows
    ]


@router.post("/conversations", response_model=AiConversationResponse)
def create_conversation(
    request: CreateConversationRequest,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    chat_repo: Annotated[SqlAiChatRepository, Depends(_chat_repo)],
) -> AiConversationResponse:
    """Create a new empty conversation for the current logged in user."""
    row = chat_repo.create_conversation(user_id, title=request.title)
    return AiConversationResponse(
        id=row["id"],
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        message_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=dict[str, Any])
def get_conversation_history(
    conversation_id: str,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    chat_repo: Annotated[SqlAiChatRepository, Depends(_chat_repo)],
) -> dict[str, Any]:
    """Get full message history of a conversation."""
    conv = chat_repo.get_conversation(conversation_id, user_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hội thoại không tồn tại")
    messages = chat_repo.list_messages(conversation_id)
    return {
        "conversation": AiConversationResponse(
            id=conv["id"],
            title=conv["title"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            message_count=len(messages),
        ),
        "messages": [
            AiMessageResponse(
                id=m["id"],
                conversation_id=m["conversation_id"],
                role=m["role"],
                content=m["content"],
                widgets=m.get("widgets") or [],
                suggested_actions=m.get("suggested_actions") or [],
                created_at=m["created_at"],
            )
            for m in messages
        ],
    }


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    user_id: Annotated[str, Depends(authenticated_user_id)],
    chat_repo: Annotated[SqlAiChatRepository, Depends(_chat_repo)],
) -> None:
    """Delete a conversation and its messages."""
    success = chat_repo.delete_conversation(conversation_id, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hội thoại không tồn tại")

