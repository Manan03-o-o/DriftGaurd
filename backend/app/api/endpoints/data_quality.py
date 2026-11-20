from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.data_quality import DataQualityAuditResponse, DataQualityAuditRequest
from app.services.data_quality_service import DataQualityService
from app.services.model_service import ModelService

router = APIRouter()


@router.post("/audit", response_model=DataQualityAuditResponse)
def audit_dataset(req: DataQualityAuditRequest, db: Session = Depends(get_db)):
    try:
        model_id = req.model_id
        if not model_id or model_id == "default":
            active_model = ModelService.get_active_or_latest_model(db)
            if not active_model:
                active_model = ModelService.ensure_default_model(db)
            model_id = active_model.id

        audit = DataQualityService.audit_model_dataset(
            db,
            model_id=model_id,
            records=req.records,
            dataset_name=req.dataset_name
        )
        return audit
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data quality audit failed: {str(e)}")


@router.post("/upload-csv", response_model=DataQualityAuditResponse)
async def upload_and_audit_csv(
    model_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        audit = DataQualityService.audit_uploaded_csv(
            db,
            model_id=model_id,
            file_contents=contents,
            filename=file.filename or "uploaded.csv"
        )
        return audit
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload and audit failed: {str(e)}")


@router.get("/history", response_model=List[DataQualityAuditResponse])
def get_quality_history(
    model_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    audits = DataQualityService.get_quality_history(db, model_id=model_id, limit=limit)
    return audits
