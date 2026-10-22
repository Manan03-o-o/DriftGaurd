from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.streams import StreamReplayRequest, StreamSessionResponse, PredictionBatchResponse
from app.services.stream_service import StreamService
from app.services.model_service import ModelService

router = APIRouter()


@router.post("/replay", response_model=StreamSessionResponse)
def replay_stream(request: StreamReplayRequest, db: Session = Depends(get_db)):
    try:
        # If model_id is 'default' or empty, use active model
        if not request.model_id or request.model_id == "default":
            active_model = ModelService.get_active_or_latest_model(db)
            if not active_model:
                active_model = ModelService.ensure_default_model(db)
            request.model_id = active_model.id

        stream = StreamService.replay_stream(db, request)
        
        # Format batch response
        batches_formatted = [
            PredictionBatchResponse(
                id=b.id,
                batch_index=b.batch_index,
                records_count=b.records_count,
                has_labels=b.ground_truth_labels is not None,
                created_at=b.created_at,
                predictions_preview=b.predictions[:5] if b.predictions else []
            )
            for b in stream.batches
        ]

        return StreamSessionResponse(
            id=stream.id,
            name=stream.name,
            model_id=stream.model_id,
            dataset_name=stream.dataset_name,
            scenario=stream.scenario,
            batch_size=stream.batch_size,
            total_batches=stream.total_batches,
            created_at=stream.created_at,
            batches=batches_formatted
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stream replay failed: {str(e)}")


@router.get("/{stream_id}", response_model=StreamSessionResponse)
def get_stream(stream_id: str, db: Session = Depends(get_db)):
    stream = StreamService.get_stream_by_id(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail=f"Stream with id '{stream_id}' not found")
        
    batches_formatted = [
        PredictionBatchResponse(
            id=b.id,
            batch_index=b.batch_index,
            records_count=b.records_count,
            has_labels=b.ground_truth_labels is not None,
            created_at=b.created_at,
            predictions_preview=b.predictions[:5] if b.predictions else []
        )
        for b in stream.batches
    ]

    return StreamSessionResponse(
        id=stream.id,
        name=stream.name,
        model_id=stream.model_id,
        dataset_name=stream.dataset_name,
        scenario=stream.scenario,
        batch_size=stream.batch_size,
        total_batches=stream.total_batches,
        created_at=stream.created_at,
        batches=batches_formatted
    )
