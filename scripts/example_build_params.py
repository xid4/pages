#!/usr/bin/env python3
"""Gera URLs de exemplo para o visualizador de PDF (parâmetro `p`).

O visualizador (`legacy/p/index.html`) recebe a configuração num único parâmetro
`p`, que é um JSON possivelmente "embaralhado". Ao ler, ele tenta decodificar o
valor nesta ordem, ficando com o primeiro que resultar num objeto JSON:

    1. JSON.parse(raw)                              -> "plain"
    2. JSON.parse(reverse(raw))                     -> "reversed"
    3. JSON.parse(base64_decode(raw))               -> "base64"
    4. JSON.parse(base64_decode(reverse(raw)))      -> "reversed_base64"
    5. JSON.parse(reverse(base64_decode(raw)))      -> "base64_reversed"

Este script constrói o valor `p` usando cada uma dessas estratégias (o inverso
da decodificação), monta a URL final e valida o round-trip.

Baseado no trecho de referência:

    # import base64
    # from urllib.parse import urlencode
    # url = 'https://.../arquivo.pdf'
    # url_cript = base64.b64encode(url.encode()).decode()[::-1]
    # f"https://xid4.github.io/pages/p/?{urlencode(dict(u=url_cript))}"

Uso:
    python3 scripts/example_build_params.py
"""

import base64
import json
import random
from urllib.parse import urlencode

# URL pública do visualizador que entende o parâmetro `p`.
# (O visualizador moderno fica em ".../pages/p/"; o legado, abaixo.)
VIEWER_URL = "https://xid4.github.io/pages/legacy/p/"

# PDF de exemplo.
PDF_URL = (
    "https://themas-aws.s3.sa-east-1.amazonaws.com/"
    "cursos/EyiU5TnKSfVLBCAaRQCPTjZOHuLLfDsD.pdf"
)


# ---------------------------------------------------------------------------
# Base64 URL-safe sem padding (o visualizador aceita "-"/"_" e re-adiciona "=").
# ---------------------------------------------------------------------------

def b64_encode(text: str) -> str:
    raw = base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii")
    return raw.rstrip("=")


def b64_decode(text: str) -> str:
    padded = text + "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")


# ---------------------------------------------------------------------------
# Estratégias de "embaralhamento" — o inverso de cada tentativa do visualizador.
# Cada codificador recebe o JSON (str) e devolve o valor a colocar em `p`.
# O decodificador correspondente reproduz o que o visualizador faz, para
# validarmos o round-trip.
# ---------------------------------------------------------------------------

ENCODERS = {
    "plain":            lambda s: s,
    "reversed":         lambda s: s[::-1],
    "base64":           lambda s: b64_encode(s),
    "reversed_base64":  lambda s: b64_encode(s)[::-1],   # viewer: reverse -> base64_decode
    "base64_reversed":  lambda s: b64_encode(s[::-1]),   # viewer: base64_decode -> reverse
}

DECODERS = {
    "plain":            lambda r: r,
    "reversed":         lambda r: r[::-1],
    "base64":           lambda r: b64_decode(r),
    "reversed_base64":  lambda r: b64_decode(r[::-1]),
    "base64_reversed":  lambda r: b64_decode(r)[::-1],
}


def encode_param(config: dict, strategy: str) -> str:
    """Serializa `config` em JSON e aplica a estratégia de embaralhamento."""
    payload = json.dumps(config, ensure_ascii=False, separators=(",", ":"))
    raw = ENCODERS[strategy](payload)

    # Sanity check: o valor gerado precisa voltar ao JSON original.
    assert json.loads(DECODERS[strategy](raw)) == config, "round-trip falhou"
    return raw


def build_url(config: dict, strategy: str) -> str:
    raw = encode_param(config, strategy)
    return f"{VIEWER_URL}?{urlencode(dict(p=raw))}"


# ---------------------------------------------------------------------------
# Exemplos de configuração.
# ---------------------------------------------------------------------------

EXAMPLES = [
    (
        "Modo restrito (sem permissões — o padrão)",
        {"u": PDF_URL},
    ),
    (
        "Somente leitura com navegação e zoom",
        {"u": PDF_URL, "nav": True, "zoomctrl": True},
    ),
    (
        "Permite baixar o PDF",
        {"u": PDF_URL, "download": True},
    ),
    (
        "Busca + seleção de texto",
        {"u": PDF_URL, "search": True, "select": True},
    ),
    (
        "Links do PDF clicáveis (anotações + URLs em texto)",
        {"u": PDF_URL, "links": True},
    ),
    (
        "Tela cheia + impressão liberada",
        {"u": PDF_URL, "fullscreen": True, "print": True},
    ),
    (
        "Tema claro, abre na página 3, ajusta à largura",
        {"u": PDF_URL, "theme": "light", "page": 3, "fit": "width"},
    ),
    (
        "Marca d'água + zoom inicial 1.5",
        {"u": PDF_URL, "watermark": "CONFIDENCIAL", "zoom": 1.5},
    ),
    (
        "Tudo liberado",
        {
            "u": PDF_URL,
            "download": True,
            "print": True,
            "contextmenu": True,
            "hotkeys": True,
            "select": True,
            "search": True,
            "links": True,
            "fullscreen": True,
        },
    ),
]


def separator(char: str = "-", width: int = 78) -> str:
    return char * width


def main() -> None:
    rng = random.Random(42)  # semente fixa: saída reproduzível
    strategies = list(ENCODERS.keys())

    print(separator("="))
    print("URLs de exemplo — visualizador de PDF (parâmetro `p`)")
    print(f"Visualizador: {VIEWER_URL}")
    print(f"PDF exemplo : {PDF_URL}")
    print(separator("="))

    # 1) Um exemplo por configuração, cada um com uma estratégia sorteada.
    for title, config in EXAMPLES:
        strategy = rng.choice(strategies)
        url = build_url(config, strategy)
        print()
        print(f"# {title}")
        print(f"  config    : {json.dumps(config, ensure_ascii=False)}")
        print(f"  estratégia: {strategy}")
        print(f"  URL       : {url}")

    # 2) Uma mesma configuração renderizada em TODAS as estratégias, para
    #    demonstrar que o visualizador aceita qualquer uma delas.
    print()
    print(separator("="))
    print("Mesma configuração em todas as estratégias de embaralhamento")
    print(separator("="))
    demo = {"u": PDF_URL, "download": True, "search": True, "select": True}
    print(f"config: {json.dumps(demo, ensure_ascii=False)}")
    for strategy in strategies:
        url = build_url(demo, strategy)
        print()
        print(f"# {strategy}")
        print(f"  {url}")

    # 3) Bônus: o esquema clássico só com a URL do PDF no parâmetro `u`
    #    (compatível com o visualizador legado), como no trecho de referência.
    print()
    print(separator("="))
    print("Compatibilidade: apenas o PDF no parâmetro `u` (reverse(base64(url)))")
    print(separator("="))
    u_cript = base64.b64encode(PDF_URL.encode()).decode()[::-1]
    legacy_url = f"{VIEWER_URL}?{urlencode(dict(u=u_cript))}"
    print(legacy_url)


if __name__ == "__main__":
    main()
