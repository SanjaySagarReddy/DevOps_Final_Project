"""API behavior against an isolated database created for each test."""

from copy import deepcopy


INCIDENT = {
    "title": "Checkout requests timing out",
    "service": "Checkout API",
    "severity": "high",
    "owner": "On-call engineer",
    "description": "Checkout requests exceed the normal response time.",
}


def create(client, **changes):
    payload = {**INCIDENT, **changes}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    return response.json()


def update(client, incident, status, **changes):
    payload = {key: incident[key] for key in INCIDENT}
    response = client.put(
        f"/api/incidents/{incident['id']}", json={**payload, **changes, "status": status}
    )
    return response


def test_health_and_database_readiness(client):
    assert client.get("/health").json() == {"status": "alive"}
    assert client.get("/ready").json() == {"status": "ready"}


def test_create_and_get_preserve_incident_details(client):
    created = create(client)
    assert created["status"] == "open"
    assert created["resolved_at"] is None
    assert created["created_at"] and created["updated_at"]

    detail = client.get(f"/api/incidents/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["description"] == INCIDENT["description"]
    assert detail.json()["owner"] == INCIDENT["owner"]


def test_list_filters_and_summary_count_database_records(client):
    create(client)
    create(
        client,
        title="Search cluster unavailable",
        service="Search API",
        severity="critical",
        description="Search requests return errors for all users.",
    )

    filtered = client.get("/api/incidents", params={"severity": "critical", "q": "Search"})
    assert filtered.status_code == 200
    assert [row["service"] for row in filtered.json()] == ["Search API"]
    assert len(client.get("/api/incidents", params={"status": "open"}).json()) == 2

    summary = client.get("/api/incidents/summary")
    assert summary.status_code == 200
    assert summary.json()["total"] == 2
    assert summary.json()["by_status"]["open"] == 2
    assert summary.json()["by_severity"]["critical"] == 1


def test_update_rejects_invalid_transition_and_sets_resolution_time(client):
    incident = create(client)
    rejected = update(client, incident, "resolved")
    assert rejected.status_code == 409
    assert client.get(f"/api/incidents/{incident['id']}").json()["status"] == "open"

    investigating = update(client, incident, "investigating", owner="Primary on-call")
    assert investigating.status_code == 200
    assert investigating.json()["owner"] == "Primary on-call"
    assert investigating.json()["resolved_at"] is None

    resolved = update(client, investigating.json(), "resolved")
    assert resolved.status_code == 200
    assert resolved.json()["resolved_at"] is not None
    assert resolved.json()["updated_at"] != incident["updated_at"]


def test_reopening_clears_resolution_timestamp(client):
    incident = create(client)
    investigating = update(client, incident, "investigating").json()
    resolved = update(client, investigating, "resolved").json()
    assert resolved["resolved_at"] is not None

    reopened = update(client, resolved, "investigating")
    assert reopened.status_code == 200
    assert reopened.json()["resolved_at"] is None


def test_delete_removes_record_and_missing_incident_returns_404(client):
    incident = create(client)
    incident_id = incident["id"]
    assert client.delete(f"/api/incidents/{incident_id}").status_code == 204
    assert client.get(f"/api/incidents/{incident_id}").status_code == 404
    assert client.delete(f"/api/incidents/{incident_id}").status_code == 404
    assert client.get("/api/incidents/summary").json()["total"] == 0


def test_invalid_input_does_not_create_incident(client):
    invalid = deepcopy(INCIDENT)
    invalid["description"] = "short"
    invalid["severity"] = "urgent"
    response = client.post("/api/incidents", json=invalid)
    assert response.status_code == 422
    assert client.get("/api/incidents").json() == []


def test_metrics_include_application_counters(client):
    create(client)
    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "incident_created_total" in metrics.text
    assert "incident_http_requests_total" in metrics.text
