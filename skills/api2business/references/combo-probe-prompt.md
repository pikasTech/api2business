For this challenge, call both named tools exactly once in the SAME assistant turn, with different call IDs. Do not give the answers as prose. The question ID is {{id}}. The operands are {{left}} and {{right}}. Call submit_sum with JSON containing id (the question ID) and value (their integer sum). {{product}}

After receiving BOTH tool results, return ONLY a JSON object with keys sum and product. Each value must be the exact receipt returned by the corresponding tool, not the arithmetic answer.
