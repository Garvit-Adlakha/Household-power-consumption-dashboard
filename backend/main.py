from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
from io import StringIO
import os
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

app = FastAPI(title="Anomaly Detection API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Define file paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models")
DEFAULT_MODEL_FILE = os.path.join(BASE_DIR, "isolation_forest_model.pkl")
DEFAULT_SCALER_FILE = os.path.join(BASE_DIR, "scaler.pkl")
DEFAULT_DATA_FILE = os.path.join(BASE_DIR, "household_power_consumption.txt")

# Ensure model directory exists
os.makedirs(MODEL_PATH, exist_ok=True)

def load_model():
    """
    Load model and scaler from files.
    First checks in the root backend directory, then in the models subdirectory.
    """
    try:
        # First try to load from backend directory
        if os.path.exists(DEFAULT_MODEL_FILE) and os.path.exists(DEFAULT_SCALER_FILE):
            model = joblib.load(DEFAULT_MODEL_FILE)
            scaler = joblib.load(DEFAULT_SCALER_FILE)
            print("Models loaded from backend directory")
        else:
            # Fall back to models subdirectory
            model_path = os.path.join(MODEL_PATH, "isolation_forest_model.pkl")
            scaler_path = os.path.join(MODEL_PATH, "scaler.pkl")
            
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                model = joblib.load(model_path)
                scaler = joblib.load(scaler_path)
                print("Models loaded from models directory")
            else:
                return None, None
                
        return model, scaler
    except Exception as e:
        print(f"Error loading models: {str(e)}")
        return None, None

def load_default_dataset():
    """
    Loads the household_power_consumption.txt dataset and preprocesses it
    """
    try:
        if not os.path.exists(DEFAULT_DATA_FILE):
            print(f"Default data file {DEFAULT_DATA_FILE} not found")
            return None
            
        df = pd.read_csv(DEFAULT_DATA_FILE, sep=';', na_values='?')
        
        # Handle date and time
        if 'Date' in df.columns and 'Time' in df.columns:
            df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
            df.drop(columns=['Date', 'Time'], inplace=True)
        
        # Convert columns to numeric
        for col in df.columns:
            if col != 'Datetime':
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Drop any rows with NaNs
        df.dropna(inplace=True)
        
        print(f"Successfully loaded default dataset with {len(df)} records")
        return df
    except Exception as e:
        print(f"Error loading default dataset: {str(e)}")
        return None

# Load model and scaler
model, scaler = load_model()

class PredictionResponse(BaseModel):
    anomalies: List[dict]
    anomaly_count: int
    total_records: int
    anomaly_percentage: float

@app.get("/")
def read_root():
    return {"message": "Welcome to the Anomaly Detection API"}

@app.post("/predict", response_model=PredictionResponse)
async def predict_anomalies(file: UploadFile = File(None)):
    global model, scaler
    
    # Check if model exists
    if model is None or scaler is None:
        raise HTTPException(status_code=500, detail="Model not trained yet. Please upload a training dataset first.")
    
    try:
        # If no file is provided, try to use default dataset
        if file is None:
            df = load_default_dataset()
            if df is None:
                raise HTTPException(status_code=400, detail="No file provided and default dataset not found")
        else:
            # Read the file
            contents = await file.read()
            contents = contents.decode("utf-8")
            
            # Determine the file format from the extension
            if file.filename.endswith('.csv'):
                df = pd.read_csv(StringIO(contents))
            elif file.filename.endswith('.txt'):
                df = pd.read_csv(StringIO(contents), sep=';', na_values='?')
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .csv or .txt file")
            
            # Handle date and time if they exist
            if 'Date' in df.columns and 'Time' in df.columns:
                df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
                df.drop(columns=['Date', 'Time'], inplace=True)
            
            # Convert columns to numeric
            for col in df.columns:
                if col != 'Datetime':
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Drop any rows with NaNs
            df.dropna(inplace=True)
        
        # Select features for anomaly detection
        features = ['Global_active_power', 'Global_reactive_power', 'Voltage', 
                   'Global_intensity', 'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3']
        
        # Check if all required features are present
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise HTTPException(status_code=400, detail=f"Missing required features: {missing_features}")
        
        # Scale the features
        X = df[features]
        X_scaled = scaler.transform(X)
        
        # Predict anomalies
        predictions = model.predict(X_scaled)
        anomaly_scores = model.decision_function(X_scaled)
        
        # Convert predictions: -1 is anomaly, 1 is normal
        df['anomaly'] = predictions
        df['anomaly'] = df['anomaly'].map({1: 0, -1: 1})  # 1 means anomaly
        df['anomaly_score'] = anomaly_scores
        
        # Prepare the response
        anomalies = []
        anomaly_df = df[df['anomaly'] == 1]
        
        for _, row in anomaly_df.iterrows():
            anomaly_data = {
                "datetime": row["Datetime"].isoformat() if "Datetime" in row.index else None,
                "global_active_power": row["Global_active_power"],
                "global_reactive_power": row["Global_reactive_power"],
                "voltage": row["Voltage"],
                "global_intensity": row["Global_intensity"],
                "sub_metering_1": row["Sub_metering_1"],
                "sub_metering_2": row["Sub_metering_2"],
                "sub_metering_3": row["Sub_metering_3"],
                "anomaly_score": float(row["anomaly_score"])
            }
            anomalies.append(anomaly_data)
        
        # Calculate stats
        total_anomalies = len(anomalies)
        total_records = len(df)
        anomaly_percentage = (total_anomalies / total_records) * 100 if total_records > 0 else 0
        
        return {
            "anomalies": anomalies,
            "anomaly_count": total_anomalies,
            "total_records": total_records,
            "anomaly_percentage": anomaly_percentage
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/train")
async def train_model(file: UploadFile = File(None)):
    global model, scaler
    
    try:
        # If no file is provided, try to use default dataset
        if file is None:
            df = load_default_dataset()
            if df is None:
                raise HTTPException(status_code=400, detail="No file provided and default dataset not found")
        else:
            contents = await file.read()
            contents = contents.decode("utf-8")
            
            # Determine the file format from the extension
            if file.filename.endswith('.csv'):
                df = pd.read_csv(StringIO(contents))
            elif file.filename.endswith('.txt'):
                df = pd.read_csv(StringIO(contents), sep=';', na_values='?')
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .csv or .txt file")
            
            # Handle date and time if they exist
            if 'Date' in df.columns and 'Time' in df.columns:
                df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
                df.drop(columns=['Date', 'Time'], inplace=True)
            
            # Convert columns to numeric
            for col in df.columns:
                if col != 'Datetime':
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Drop any rows with NaNs
            df.dropna(inplace=True)
        
        # Select features for anomaly detection
        features = ['Global_active_power', 'Global_reactive_power', 'Voltage', 
                   'Global_intensity', 'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3']
        
        # Check if all required features are present
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise HTTPException(status_code=400, detail=f"Missing required features: {missing_features}")
        
        # Scale the features
        X = df[features]
        
        # Try to load existing scaler or create a new one
        try:
            if os.path.exists(DEFAULT_SCALER_FILE):
                scaler = joblib.load(DEFAULT_SCALER_FILE)
                X_scaled = scaler.transform(X)
            else:
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)
        except Exception as e:
            # If there's an error, create a new scaler
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
        
        # Train the model
        model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
        model.fit(X_scaled)
        
        # Save the model and scaler to both locations
        joblib.dump(model, DEFAULT_MODEL_FILE)
        joblib.dump(scaler, DEFAULT_SCALER_FILE)
        joblib.dump(model, os.path.join(MODEL_PATH, "isolation_forest_model.pkl"))
        joblib.dump(scaler, os.path.join(MODEL_PATH, "scaler.pkl"))
        
        return {"message": "Model trained and saved successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

@app.get("/anomalies", response_model=PredictionResponse)
async def get_anomalies(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    feature_filter: Optional[str] = None
):
    global model, scaler
    
    # Check if model exists
    if model is None or scaler is None:
        # Try to load the models first
        model, scaler = load_model()
        if model is None or scaler is None:
            raise HTTPException(status_code=500, detail="Models not available. Please train the model first.")
    
    try:
        # Load the default dataset
        df = load_default_dataset()
        if df is None:
            raise HTTPException(status_code=404, detail="Default dataset not found")
        
        # Filter by date range if provided
        if start_date and "Datetime" in df.columns:
            try:
                print(f"Filtering from start date: {start_date}")
                start_datetime = pd.to_datetime(start_date, errors='coerce')
                if pd.isna(start_datetime):
                    raise ValueError(f"Invalid start_date format: {start_date}")
                df = df[df["Datetime"] >= start_datetime]
                print(f"After start date filter: {len(df)} records")
            except Exception as e:
                print(f"Error parsing start_date: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid start_date format: {str(e)}")
        
        if end_date and "Datetime" in df.columns:
            try:
                print(f"Filtering to end date: {end_date}")
                end_datetime = pd.to_datetime(end_date, errors='coerce')
                if pd.isna(end_datetime):
                    raise ValueError(f"Invalid end_date format: {end_date}")
                df = df[df["Datetime"] <= end_datetime]
                print(f"After end date filter: {len(df)} records")
            except Exception as e:
                print(f"Error parsing end_date: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid end_date format: {str(e)}")
        
        # Ensure we still have data after filtering
        if len(df) == 0:
            return {
                "anomalies": [],
                "anomaly_count": 0,
                "total_records": 0,
                "anomaly_percentage": 0
            }
        
        # Select features for anomaly detection
        features = ['Global_active_power', 'Global_reactive_power', 'Voltage', 
                   'Global_intensity', 'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3']
        
        # Scale the features
        X = df[features]
        X_scaled = scaler.transform(X)
        
        # Predict anomalies
        predictions = model.predict(X_scaled)
        anomaly_scores = model.decision_function(X_scaled)
        
        # Convert predictions: -1 is anomaly, 1 is normal
        df['anomaly'] = predictions
        df['anomaly'] = df['anomaly'].map({1: 0, -1: 1})  # 1 means anomaly
        df['anomaly_score'] = anomaly_scores
        
        # Filter by specific features if requested
        if feature_filter and feature_filter in features:
            # Sort by the specified feature to find anomalies with highest/lowest values
            df = df.sort_values(by=feature_filter, ascending=False)
        
        # Prepare the response
        anomalies = []
        anomaly_df = df[df['anomaly'] == 1]
        
        # Limit to a reasonable number to prevent response size issues
        max_anomalies = 1000  # Limit to 1000 anomalies to prevent huge responses
        anomaly_df = anomaly_df.head(max_anomalies)
        
        print(f"Found {len(anomaly_df)} anomalies out of {len(df)} records")
        
        for _, row in anomaly_df.iterrows():
            anomaly_data = {
                "datetime": row["Datetime"].isoformat() if "Datetime" in row.index else None,
                "global_active_power": float(row["Global_active_power"]),
                "global_reactive_power": float(row["Global_reactive_power"]),
                "voltage": float(row["Voltage"]),
                "global_intensity": float(row["Global_intensity"]),
                "sub_metering_1": float(row["Sub_metering_1"]),
                "sub_metering_2": float(row["Sub_metering_2"]),
                "sub_metering_3": float(row["Sub_metering_3"]),
                "anomaly_score": float(row["anomaly_score"])
            }
            anomalies.append(anomaly_data)
        
        # Calculate stats
        total_anomalies = len(anomalies)
        total_records = len(df)
        anomaly_percentage = (total_anomalies / total_records) * 100 if total_records > 0 else 0
        
        return {
            "anomalies": anomalies,
            "anomaly_count": total_anomalies,
            "total_records": total_records,
            "anomaly_percentage": anomaly_percentage
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"Error in get_anomalies: {str(e)}")
        print(traceback_str)
        raise HTTPException(status_code=500, detail=f"Error analyzing dataset: {str(e)}")

@app.get("/analyze-default-data", response_model=PredictionResponse)
async def analyze_default_dataset(sample_size: Optional[int] = None):
    """
    Analyze the default household_power_consumption.txt dataset
    Optional sample_size parameter to limit the amount of data processed
    """
    global model, scaler
    
    # Check if model exists
    if model is None or scaler is None:
        # Try to load the models first
        model, scaler = load_model()
        if model is None or scaler is None:
            raise HTTPException(status_code=500, detail="Models not available. Please train the model first.")
    
    try:
        # Load the default dataset
        df = load_default_dataset()
        if df is None:
            raise HTTPException(status_code=404, detail="Default dataset not found")
        
        # Take a sample if specified
        if sample_size and sample_size > 0 and sample_size < len(df):
            df = df.sample(sample_size, random_state=42)
        
        # Select features for anomaly detection
        features = ['Global_active_power', 'Global_reactive_power', 'Voltage', 
                   'Global_intensity', 'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3']
        
        # Scale the features
        X = df[features]
        X_scaled = scaler.transform(X)
        
        # Predict anomalies
        predictions = model.predict(X_scaled)
        anomaly_scores = model.decision_function(X_scaled)
        
        # Convert predictions: -1 is anomaly, 1 is normal
        df['anomaly'] = predictions
        df['anomaly'] = df['anomaly'].map({1: 0, -1: 1})  # 1 means anomaly
        df['anomaly_score'] = anomaly_scores
        
        # Prepare the response
        anomalies = []
        anomaly_df = df[df['anomaly'] == 1]
        
        for _, row in anomaly_df.iterrows():
            anomaly_data = {
                "datetime": row["Datetime"].isoformat() if "Datetime" in row.index else None,
                "global_active_power": row["Global_active_power"],
                "global_reactive_power": row["Global_reactive_power"],
                "voltage": row["Voltage"],
                "global_intensity": row["Global_intensity"],
                "sub_metering_1": row["Sub_metering_1"],
                "sub_metering_2": row["Sub_metering_2"],
                "sub_metering_3": row["Sub_metering_3"],
                "anomaly_score": float(row["anomaly_score"])
            }
            anomalies.append(anomaly_data)
        
        # Calculate stats
        total_anomalies = len(anomalies)
        total_records = len(df)
        anomaly_percentage = (total_anomalies / total_records) * 100 if total_records > 0 else 0
        
        return {
            "anomalies": anomalies,
            "anomaly_count": total_anomalies,
            "total_records": total_records,
            "anomaly_percentage": anomaly_percentage
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing default dataset: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)