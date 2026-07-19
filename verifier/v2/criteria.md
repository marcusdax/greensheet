# Verifier v2 Criteria
Same as v1, except locale parity is CLDR-plural-aware: keys are compared with plural suffixes (_one/_other/_many/_few/_zero/_two) stripped, so legitimate per-locale plural category differences (zh-CN: _other only; es-MX/pt-BR: adds _many) do not fail. Placeholder byte-consistency within each concrete key is still enforced.
