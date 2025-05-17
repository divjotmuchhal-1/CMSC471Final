
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import json
from datetime import timedelta

# Load and preprocess
df = pd.read_csv("final/data/weather.csv")
df['date'] = pd.to_datetime(df['date'], format='%Y%m%d')
df['TAVG'] = df['TAVG'].fillna((df['TMIN'] + df['TMAX']) / 2)
df.dropna(subset=['TAVG', 'PRCP', 'AWND', 'WDF5'], inplace=True)

# Aggregate by state and date
daily = df.groupby(['state', 'date']).agg({
    'TAVG': 'mean', 'PRCP': 'mean', 'AWND': 'mean', 'WDF5': 'mean'
}).reset_index()
daily.sort_values(['state', 'date'], inplace=True)
daily['year'] = daily['date'].dt.year
daily['month'] = daily['date'].dt.month
daily['day'] = daily['date'].dt.day

all_preds = []

for state in daily['state'].unique():
    s_df = daily[daily['state'] == state].copy()

    for col in ['TAVG', 'PRCP', 'AWND', 'WDF5']:
        s_df[f'{col}_lag1'] = s_df[col].shift(1)
        s_df[f'{col}_lag2'] = s_df[col].shift(2)

    s_df.dropna(inplace=True)
    if len(s_df) < 10:
        continue

    models = {}
    for var in ['TAVG', 'PRCP', 'AWND', 'WDF5']:
        X = s_df[[f'{var}_lag1', f'{var}_lag2']]
        y = s_df[var]
        models[var] = LinearRegression().fit(X, y)

    last_known = s_df.iloc[-2:].copy()
    last_date = s_df['date'].max()

    for _ in range(120):  # ~4 months
        next_day = {}
        for var in ['TAVG', 'PRCP', 'AWND', 'WDF5']:
            lag1 = last_known.iloc[-1][var]
            lag2 = last_known.iloc[-2][var]
            pred = models[var].predict([[lag1, lag2]])[0]
            next_day[var] = pred

        future_date = last_date + timedelta(days=1)
        all_preds.append({
            "date": int(future_date.strftime('%Y%m%d')),
            "year": future_date.year,
            "month": future_date.month,
            "day": future_date.day,
            "state": state,
            "TAVG": round(next_day['TAVG'], 2),
            "PRCP": round(next_day['PRCP'], 2),
            "AWND": round(next_day['AWND'], 2),
            "WDF5": round(next_day['WDF5'], 2),
            "predicted": True
        })

        last_known = pd.concat([
            last_known.iloc[1:],
            pd.DataFrame([{**next_day}], index=[0])
        ], ignore_index=True)
        last_date = future_date

# Save to JSON
with open("forecast_predictions.json", "w") as f:
    json.dump(all_preds, f, indent=2)

print("✅ Saved forecast_predictions.json with 4-month forecasts for TAVG, PRCP, AWND, and WDF5")
