import yfinance as yf

def fetch_current_price(symbol: str) -> float:
    ticker = yf.Ticker(symbol)

    data = ticker.history(period="1d")

    if data.empty:
        raise ValueError(f"price data not found: {symbol}")
    
    latest_close = data["Close"].iloc[-1]

    return float(latest_close)

if __name__ == "__main__":
    symbols = ["AAPL","7203.T"]

    for symbol in symbols:
        try:
            price = fetch_current_price(symbol)
            print(symbol,price)
        except Exception as e:
            print(symbol,"ERROR",e)

