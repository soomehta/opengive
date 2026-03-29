from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from dagster_pipeline.utils.tracking import (
    complete_scrape_run,
    fail_scrape_run,
    start_scrape_run,
)


def _make_mock_client(insert_data: list[dict] | None = None) -> MagicMock:
    """Build a Supabase client mock that chains .table().insert().execute() etc.

    Args:
        insert_data: Data list to return from the insert execute response.

    Returns:
        Configured MagicMock mimicking the Supabase client fluent API.
    """
    client = MagicMock()

    # insert chain
    insert_exec = MagicMock()
    insert_exec.data = [{"id": "test-uuid-1234"}] if insert_data is None else insert_data
    client.table.return_value.insert.return_value.execute.return_value = insert_exec

    # update chain
    update_exec = MagicMock()
    update_exec.data = []
    (
        client.table.return_value
        .update.return_value
        .eq.return_value
        .execute.return_value
    ) = update_exec

    return client


class TestStartScrapeRun:
    def test_returns_run_id(self) -> None:
        client = _make_mock_client(insert_data=[{"id": "abc-123"}])
        run_id = start_scrape_run(client, source="us_propublica", spider_name="fetch_propublica")
        assert run_id == "abc-123"

    def test_inserts_into_scrape_runs_table(self) -> None:
        client = _make_mock_client()
        start_scrape_run(client, source="uk_charity_commission", spider_name="fetch_uk")
        client.table.assert_called_with("scrape_runs")

    def test_insert_payload_contains_required_fields(self) -> None:
        client = _make_mock_client()
        start_scrape_run(
            client,
            source="us_propublica",
            spider_name="fetch_propublica",
            metadata={"pages": 5},
        )
        insert_call_args = client.table.return_value.insert.call_args
        payload: dict = insert_call_args[0][0]
        assert payload["source"] == "us_propublica"
        assert payload["spider_name"] == "fetch_propublica"
        assert payload["status"] == "running"
        assert payload["metadata"] == {"pages": 5}

    def test_raises_when_no_data_returned(self) -> None:
        client = _make_mock_client(insert_data=[])
        with pytest.raises(RuntimeError, match="no data returned"):
            start_scrape_run(client, source="us_propublica", spider_name="fetch_propublica")

    def test_default_metadata_is_empty_dict(self) -> None:
        client = _make_mock_client()
        start_scrape_run(client, source="us_propublica", spider_name="fetch_propublica")
        payload: dict = client.table.return_value.insert.call_args[0][0]
        assert payload["metadata"] == {}


class TestCompleteScrapeRun:
    def test_updates_correct_run_id(self) -> None:
        client = _make_mock_client()
        complete_scrape_run(
            client,
            run_id="run-999",
            records_found=100,
            records_new=80,
            records_updated=20,
        )
        client.table.return_value.update.return_value.eq.assert_called_with(
            "id", "run-999"
        )

    def test_status_set_to_completed(self) -> None:
        client = _make_mock_client()
        complete_scrape_run(
            client,
            run_id="run-1",
            records_found=50,
            records_new=30,
            records_updated=20,
        )
        update_payload: dict = client.table.return_value.update.call_args[0][0]
        assert update_payload["status"] == "completed"

    def test_record_counts_in_payload(self) -> None:
        client = _make_mock_client()
        complete_scrape_run(
            client,
            run_id="run-2",
            records_found=200,
            records_new=150,
            records_updated=50,
            records_failed=5,
        )
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert payload["records_found"] == 200
        assert payload["records_new"] == 150
        assert payload["records_updated"] == 50
        assert payload["records_failed"] == 5

    def test_optional_metadata_included_when_provided(self) -> None:
        client = _make_mock_client()
        complete_scrape_run(
            client,
            run_id="run-3",
            records_found=10,
            records_new=10,
            records_updated=0,
            metadata={"duration_s": 42.1},
        )
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert payload["metadata"] == {"duration_s": 42.1}

    def test_metadata_absent_when_not_provided(self) -> None:
        client = _make_mock_client()
        complete_scrape_run(
            client,
            run_id="run-4",
            records_found=10,
            records_new=10,
            records_updated=0,
        )
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert "metadata" not in payload


class TestFailScrapeRun:
    def test_status_set_to_failed(self) -> None:
        client = _make_mock_client()
        fail_scrape_run(client, run_id="run-fail-1", error="Connection timeout")
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert payload["status"] == "failed"

    def test_error_log_set(self) -> None:
        client = _make_mock_client()
        fail_scrape_run(
            client, run_id="run-fail-2", error="ValueError: bad data"
        )
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert payload["error_log"] == "ValueError: bad data"

    def test_updates_correct_run_id(self) -> None:
        client = _make_mock_client()
        fail_scrape_run(client, run_id="run-fail-3", error="oops")
        client.table.return_value.update.return_value.eq.assert_called_with(
            "id", "run-fail-3"
        )

    def test_partial_counts_recorded(self) -> None:
        client = _make_mock_client()
        fail_scrape_run(
            client,
            run_id="run-fail-4",
            error="partial failure",
            records_found=50,
            records_new=10,
            records_updated=5,
        )
        payload: dict = client.table.return_value.update.call_args[0][0]
        assert payload["records_found"] == 50
        assert payload["records_new"] == 10
        assert payload["records_updated"] == 5
