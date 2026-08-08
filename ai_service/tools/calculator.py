from langchain_core.tools import tool


@tool
def calculator(expression: str) -> dict:
    """Perform basic mathematical calculations. Pass a math expression like '1500 + 2300' or '75000 * 0.2'."""
    try:
        # ponytail: eval with restricted builtins — safe enough for math expressions, no file/os access
        allowed_names = {"__builtins__": {}}
        result = eval(expression, allowed_names, {})
        return {"expression": expression, "result": float(result), "status": "success"}
    except Exception as e:
        return {"expression": expression, "error": str(e), "status": "error"}
