import { useState, useRef, ChangeEvent } from 'react';
import { predictAnomalies, trainModel, PredictionResponse } from '../services/api';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle, Upload as UploadIcon } from 'lucide-react';

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'predict' | 'train'>('predict');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check if the file is a CSV or TXT
      if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
        setError('Please upload a CSV or TXT file.');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setSuccess(null);
      setPredictionResult(null);
      
      // Read the file to preview its contents
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          // Show first few lines
          const lines = content.split('\n').slice(0, 10);
          setFilePreview(lines);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (mode === 'predict') {
        const result = await predictAnomalies(file);
        setPredictionResult(result);
        setSuccess(`File processed successfully. Found ${result.anomaly_count} anomalies out of ${result.total_records} records.`);
      } else {
        const result = await trainModel(file);
        setSuccess(result.message);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || err.message || 'An error occurred during file processing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFilePreview([]);
    setPredictionResult(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Upload Power Consumption Data</h2>
        
        {/* Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Operation Mode</label>
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 rounded-md ${mode === 'predict' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setMode('predict')}
            >
              Predict Anomalies
            </button>
            <button
              className={`px-4 py-2 rounded-md ${mode === 'train' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setMode('train')}
            >
              Train Model
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {mode === 'predict' ? 
              'Upload a file to detect anomalies using the trained model.' : 
              'Upload a file to train a new anomaly detection model.'}
          </p>
        </div>
        
        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File (.csv or .txt)
          </label>
          <div className="mt-1 flex items-center">
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              <UploadIcon className="h-4 w-4 mr-2 inline" />
              Choose file
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              accept=".csv,.txt"
            />
            <span className="ml-3 text-sm text-gray-500">
              {file ? file.name : 'No file selected'}
            </span>
            {file && (
              <button
                onClick={handleReset}
                className="ml-3 text-sm text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            File should contain power consumption data with columns like Global_active_power, Global_reactive_power, etc.
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-4">
          <button
            onClick={handleUpload}
            disabled={!file || isLoading}
            className={`px-4 py-2 rounded-md ${
              !file || isLoading 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? 'Processing...' : mode === 'predict' ? 'Detect Anomalies' : 'Train Model'}
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* File Preview */}
      {filePreview.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm overflow-x-auto">
          <h3 className="text-lg font-medium mb-4">File Preview</h3>
          <pre className="text-xs text-gray-700 font-mono">
            {filePreview.join('\n')}
          </pre>
          <p className="mt-2 text-xs text-gray-500">
            Showing first 10 lines of the file.
          </p>
        </div>
      )}

      {/* Prediction Results */}
      {predictionResult && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-4">Prediction Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-xl font-semibold">{predictionResult.total_records}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-md">
              <p className="text-sm text-gray-500">Anomalies Detected</p>
              <p className="text-xl font-semibold text-red-600">{predictionResult.anomaly_count}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-md">
              <p className="text-sm text-gray-500">Anomaly Percentage</p>
              <p className="text-xl font-semibold">{predictionResult.anomaly_percentage.toFixed(2)}%</p>
            </div>
          </div>

          {/* Anomalies Table */}
          {predictionResult.anomalies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datetime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Global Active Power
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Global Reactive Power
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voltage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Anomaly Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {predictionResult.anomalies.slice(0, 10).map((anomaly, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.datetime ? format(parseISO(anomaly.datetime), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.global_active_power.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.global_reactive_power.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.voltage.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.anomaly_score.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {predictionResult.anomalies.length > 10 && (
                <p className="mt-2 text-sm text-gray-500">
                  Showing 10 of {predictionResult.anomalies.length} anomalies.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Upload;