"""Eval runner — roda cases.yaml contra o agent e calcula metricas.

Uso:
    uv run python -m iga_ai.eval.runner

Output: tabela accuracy + tool-call precision + violations por caso.
"""

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from iga_ai.agents.copilot import run_agent
from iga_ai.agents.prompts import build_dynamic_system_prompt
from iga_ai.tools.client import NodeClient

CASES_PATH = Path(__file__).parent / "cases.yaml"


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    tool_calls: list[str]
    response: str
    violations: list[str]


def load_cases() -> list[dict[str, Any]]:
    with CASES_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("cases", [])


async def run_case(case: dict[str, Any]) -> CaseResult:
    user_prompt = case["prompt"]
    role = case.get("role", "admin")
    expected_tools = case.get("tool_call_expected", [])
    must_contain = case.get("response_must_contain", [])
    must_not_contain = case.get("response_must_not_contain", [])

    node_client = NodeClient(jwt_shared="dev", conversation_id=case["id"])
    system_prompt = build_dynamic_system_prompt(
        user_name="Maria",
        user_role=role,
        monthly_goal=None,
    )

    tool_calls: list[str] = []
    response_parts: list[str] = []
    async for evt in run_agent(
        node_client=node_client,
        system_prompt=system_prompt,
        history=[],
        user_prompt=user_prompt,
        plan="pro",
    ):
        if evt.get("type") == "token":
            response_parts.append(str(evt.get("text", "")))
        elif evt.get("type") == "tool_call":
            tool_calls.append(str(evt.get("name", "")))

    response = "".join(response_parts)
    violations: list[str] = []
    if expected_tools and not any(t in tool_calls for t in expected_tools):
        violations.append(f"missing_tool_call (expected one of {expected_tools}, got {tool_calls})")
    for needle in must_contain:
        if needle.lower() not in response.lower():
            violations.append(f"missing_in_response: {needle}")
    for needle in must_not_contain:
        if needle.lower() in response.lower():
            violations.append(f"forbidden_in_response: {needle}")

    return CaseResult(
        case_id=case["id"],
        passed=not violations,
        tool_calls=tool_calls,
        response=response,
        violations=violations,
    )


async def main() -> None:
    cases = load_cases()
    results: list[CaseResult] = []
    for case in cases:
        try:
            result = await run_case(case)
        except Exception as exc:  # noqa: BLE001
            result = CaseResult(
                case_id=case["id"],
                passed=False,
                tool_calls=[],
                response="",
                violations=[f"runtime_error: {exc}"],
            )
        results.append(result)
        symbol = "OK" if result.passed else "FAIL"
        print(f"[{symbol}] {result.case_id}: {','.join(result.violations) or 'ok'}")

    passed_n = sum(1 for r in results if r.passed)
    total_n = len(results)
    print(f"\n=== Summary: {passed_n}/{total_n} ({100 * passed_n / total_n:.1f}%) ===")
    print(json.dumps({"passed": passed_n, "total": total_n}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
