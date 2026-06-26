import os
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

from fetch_price import fetch_current_price


load_dotenv()


@dataclass
class Stock:
    id: int
    symbol: str
    market: str


def get_worker_headers() -> dict[str, str]:
    worker_secret = os.getenv("WORKER_SECRET")

    if worker_secret is None:
        raise RuntimeError("WORKER_SECRET is not set")

    return {
        "x-worker-token": worker_secret,
    }


def to_yfinance_symbol(stock: Stock) -> str:
    if stock.market == "JP":
        if stock.symbol.endswith(".T"):
            return stock.symbol
        return f"{stock.symbol}.T"

    if stock.market == "US":
        return stock.symbol

    raise ValueError(f"unsupported market: {stock.market}")


def fetch_stocks(base_url: str) -> list[Stock]:
    url = f"{base_url}/internal/stocks/price-targets"

    response = requests.get(
        url,
        headers=get_worker_headers(),
        timeout=10,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"failed to fetch stocks: status={response.status_code}, body={response.text}"
        )

    data = response.json()

    return [
        Stock(
            id=item["id"],
            symbol=item["symbol"],
            market=item["market"],
        )
        for item in data
    ]


def update_backend_price(base_url: str, stock_id: int, current_price: float) -> None:
    url = f"{base_url}/internal/stocks/{stock_id}/price"

    response = requests.patch(
        url,
        headers=get_worker_headers(),
        json={
            "currentPrice": current_price,
        },
        timeout=10,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"failed to update stock_id={stock_id}: "
            f"status={response.status_code}, body={response.text}"
        )


def main() -> None:
    base_url = os.getenv("BACKEND_BASE_URL")

    if base_url is None:
        raise RuntimeError("BACKEND_BASE_URL is not set")

    stocks = fetch_stocks(base_url)

    print(f"found {len(stocks)} stocks")

    for stock in stocks:
        yfinance_symbol = to_yfinance_symbol(stock)

        try:
            price = fetch_current_price(yfinance_symbol)
            update_backend_price(base_url, stock.id, price)

            print(
                f"updated: id={stock.id}, "
                f"symbol={stock.symbol}, "
                f"market={stock.market}, "
                f"yf_symbol={yfinance_symbol}, "
                f"price={price}"
            )
        except Exception as e:
            print(
                f"ERROR: id={stock.id}, "
                f"symbol={stock.symbol}, "
                f"market={stock.market}, "
                f"yf_symbol={yfinance_symbol}, "
                f"error={e}"
            )


if __name__ == "__main__":
    main()