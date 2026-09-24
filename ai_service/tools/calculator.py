import ast
import operator

from langchain_core.tools import tool

_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_MAX_LENGTH = 200
_MAX_EXPONENT = 100
_MAX_VALUE = 1e15


def _evaluate(node: ast.AST) -> int | float:
    """Evaluate a tree made only of numbers, + - * / // % ** and parentheses.

    Every value (literal or intermediate) must stay within +-1e15, and ``**``
    exponents within +-100, so no input can pin the CPU or exhaust memory.
    """
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        result = node.value
    elif isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        result = _UNARY[type(node.op)](_evaluate(node.operand))
    elif isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _evaluate(node.left), _evaluate(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise ValueError("Exponent is too large")
        result = _BINARY[type(node.op)](left, right)
    else:
        raise ValueError("Only numbers and + - * / // % ** ( ) are allowed")
    if isinstance(result, complex) or not abs(result) <= _MAX_VALUE:
        raise ValueError("Result is out of range")
    return result


@tool
def calculator(expression: str) -> dict:
    """Perform basic mathematical calculations. Pass a math expression like '1500 + 2300' or '75000 * 0.2'. Only numbers, + - * / // % ** and parentheses are supported (no functions or names)."""
    try:
        if len(expression) > _MAX_LENGTH:
            raise ValueError(f"Expression is longer than {_MAX_LENGTH} characters")
        result = _evaluate(ast.parse(expression.strip(), mode="eval").body)
        return {"expression": expression, "result": float(result), "status": "success"}
    except Exception as e:
        return {"expression": expression, "error": str(e), "status": "error"}
