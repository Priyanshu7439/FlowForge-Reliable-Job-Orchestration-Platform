import pytest
from fastapi import HTTPException

from services.executor.app.main import ExecuteRequest, csv_validate, execute, json_transform, report_generate

def test_json_transform_selects_fields():
    summary, result = json_transform({"records": [{"name": "Ada", "role": "engineer"}], "select": ["name"]})
    assert summary["records"] == 1
    assert result == [{"name": "Ada"}]

def test_csv_validation_counts_missing_values():
    summary, _ = csv_validate({"csv": "name,team\nAda,Platform\nGrace,\n"})
    assert summary["rows"] == 2
    assert summary["missingValues"] == 1

def test_json_transform_rejects_non_object_records():
    with pytest.raises(ValueError, match="every record must be an object"):
        json_transform({"records": ["not-an-object"]})

def test_failure_simulation_is_retryable_then_succeeds():
    request = ExecuteRequest(jobId="job-1", type="FAILURE_SIMULATION", payload={"failUntilAttempt": 1}, attempt=1)
    failed = execute(request, "Bearer replace-with-an-internal-service-secret")
    assert failed["ok"] is False
    assert failed["error"]["retryable"] is True

    request.attempt = 2
    recovered = execute(request, "Bearer replace-with-an-internal-service-secret")
    assert recovered["ok"] is True
    assert recovered["summary"]["succeededOnAttempt"] == 2

def test_executor_rejects_invalid_authentication():
    request = ExecuteRequest(jobId="job-1", type="JSON_TRANSFORM", payload={"records": []}, attempt=1)
    with pytest.raises(HTTPException):
        execute(request, "Bearer wrong-secret")

def test_report_generation_returns_report_metadata():
    summary, result = report_generate({"records": [{"name": "Ada"}]})
    assert summary["reportType"] == "JSON transformation report"
    assert result["summary"]["records"] == 1
