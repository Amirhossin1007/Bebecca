from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_python_node_runtime_module_is_retired():
    assert not (ROOT / "app" / "jobs" / "node_runtime.py").exists()


def test_go_usage_collector_is_available():
    collector_path = ROOT / "app" / "jobs" / "usage" / "go_collector.py"
    source = collector_path.read_text(encoding="utf-8")

    assert "def record_user_usages" in source
    assert "def record_node_usages" in source
