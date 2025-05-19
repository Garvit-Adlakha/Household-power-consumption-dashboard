import axios from 'axios';

const API_URL = 'http://localhost:8000'; // Changed to port 8080 to match running server

const api = axios.create({
  baseURL: API_URL,
});

export interface AnomalyData {
  datetime: string;
  global_active_power: number;
  global_reactive_power: number;
  voltage: number;
  global_intensity: number;
  sub_metering_1: number;
  sub_metering_2: number;
  sub_metering_3: number;
  anomaly_score: number;
}

export interface PredictionResponse {
  anomalies: AnomalyData[];
  anomaly_count: number;
  total_records: number;
  anomaly_percentage: number;
}

export const predictAnomalies = async (file: File): Promise<PredictionResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post<PredictionResponse>('/predict', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

/**
 * Predict anomalies using the default dataset (household_power_consumption.txt)
 * No file upload needed
 */
export const predictWithDefaultData = async (): Promise<PredictionResponse> => {
  const response = await api.post<PredictionResponse>('/predict');
  return response.data;
};

/**
 * Analyze the default dataset with an optional sample size
 */
export const analyzeDefaultData = async (sampleSize?: number): Promise<PredictionResponse> => {
  const params = sampleSize ? { sample_size: sampleSize } : {};
  const response = await api.get<PredictionResponse>('/analyze-default-data', { params });
  return response.data;
};

export const trainModel = async (file: File): Promise<{ message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post<{ message: string }>('/train', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

/**
 * Train the model using the default dataset (household_power_consumption.txt)
 * No file upload needed
 */
export const trainWithDefaultData = async (): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/train');
  return response.data;
};

export const getAnomalies = async (
  startDate?: string,
  endDate?: string,
  featureFilter?: string
): Promise<PredictionResponse> => {
  // Use specific date formats to ensure compatibility with the backend
  const params: any = {};
  
  if (startDate) {
    params.start_date = startDate;
  }
  
  if (endDate) {
    params.end_date = endDate;
  }
  
  if (featureFilter) {
    // Make sure we're sending the correct feature name format to the backend
    // The backend expects: Global_active_power, Global_reactive_power, etc.
    params.feature_filter = featureFilter;
  }
  
  try {
    console.log('API Request params:', params);
    const response = await api.get('/anomalies', { params });
    console.log('API Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

export default api;