import csv
import io
import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="FlowForge Executor", version="1.0.0")
SECRET = os.getenv("EXECUTOR_SHARED_SECRET", "replace-with-an-internal-service-secret")

class ExecuteRequest(BaseModel):
    jobId: str
    type: str
    payload: dict[str, Any]
    attempt: int = Field(ge=1)

def json_transform(payload: dict[str, Any]) -> tuple[dict[str, Any], Any]:
    records = payload.get("records")
    if not isinstance(records, list) or len(records) > 10_000:
        raise ValueError("records must be a list of at most 10000 items")
    select = payload.get("select")
    if select is not None and (not isinstance(select, list) or not all(isinstance(item, str) for item in select)):
        raise ValueError("select must be a list of field names")
    result = []
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("every record must be an object")
        item = {key: record[key] for key in select if key in record} if select else dict(record)
        result.append(item)
    return {"records": len(result), "fields": sorted({key for item in result for key in item})}, result

def csv_validate(payload: dict[str, Any]) -> tuple[dict[str, Any], Any]:
    text = payload.get("csv")
    if not isinstance(text, str) or len(text.encode()) > 2_000_000:
        raise ValueError("csv must be text no larger than 2MB")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows or not rows[0]:
        raise ValueError("csv must include a header and at least one row")
    duplicates = len(rows) - len({tuple(sorted(row.items())) for row in rows})
    missing = sum(1 for row in rows for value in row.values() if value is None or value.strip() == "")
    return {"rows": len(rows), "columns": len(rows[0]), "duplicateRows": duplicates, "missingValues": missing}, rows

def report_generate(payload: dict[str, Any]) -> tuple[dict[str, Any], Any]:
    summary, records = json_transform(payload)
    return {
        "records": summary["records"],
        "fields": summary["fields"],
        "reportType": "JSON transformation report",
    }, {
        "summary": summary,
        "records": records,
    }

@app.get("/health/live")
def live(): return {"status": "ok"}

@app.post("/internal/execute")
def execute(request: ExecuteRequest, authorization: str | None = Header(default=None)):
    if authorization != f"Bearer {SECRET}": raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        if request.type == "JSON_TRANSFORM": summary, result = json_transform(request.payload)
        elif request.type == "CSV_VALIDATE": summary, result = csv_validate(request.payload)
        elif request.type == "REPORT_GENERATE": summary, result = report_generate(request.payload)
        elif request.type == "FAILURE_SIMULATION":
            fail_until = int(request.payload.get("failUntilAttempt", 1))
            if request.attempt <= fail_until: return {"ok": False, "summary": {"simulated": True}, "error": {"code": "SIMULATED_TRANSIENT_FAILURE", "message": "Controlled demo failure", "retryable": True}}
            summary, result = {"simulated": True, "succeededOnAttempt": request.attempt}, {"message": "Recovered after simulated retry"}
        else: raise ValueError("unsupported task type")
        return {"ok": True, "summary": summary, "result": result}
    except ValueError as exc:
        return {"ok": False, "summary": {}, "error": {"code": "INVALID_TASK_INPUT", "message": str(exc), "retryable": False}}
