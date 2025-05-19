import { useState, useEffect } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, Scatter, ScatterChart, ZAxis 
} from 'recharts';
import { AnomalyData, getAnomalies } from '../services/api';

interface FilterState {
  startDate: string;
  endDate: string;
  feature: string;
}

const Dashboard = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    feature: 'global_active_power'
  });
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateConfirmed) return;
      
      setIsLoading(true);
      setError(null);
      try {
        const response = await getAnomalies(filters.startDate, filters.endDate, filters.feature);
        
        if (response && response.anomalies) {
          // Add 'anomaly' flag for filtering
          const processedData = response.anomalies.map(item => ({
            ...item,
            anomaly: 1 // All items from anomalies array are anomalies
          }));
          
          setData(processedData);
          setAnomalyCount(response.anomaly_count || processedData.length);
          setTotalRecords(response.total_records || 0);
        } else {
          setError('No anomaly data available.');
          setData([]);
          setAnomalyCount(0);
          setTotalRecords(0);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data from server.');
        setData([]);
        setAnomalyCount(0);
        setTotalRecords(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [filters, dateConfirmed]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    if (name === 'startDate' || name === 'endDate') {
      setDateConfirmed(false);
    }
  };

  const handleDateConfirm = () => {
    setDateConfirmed(true);
  };

  const anomalyData = data.filter(item => item.anomaly === 1);
  
  return (
    <div className="space-y-6">
      {/* Date Selection and Confirmation */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-4">Select Date Range</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
          <div>
            <button
              onClick={handleDateConfirm}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm"
            >
              Confirm Date Range
            </button>
          </div>
        </div>
      </div>

      {dateConfirmed ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Total Anomalies</h3>
              <p className="text-2xl font-bold text-red-600">{anomalyCount}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Total Records</h3>
              <p className="text-2xl font-bold">{totalRecords}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Anomaly Rate</h3>
              <p className="text-2xl font-bold text-amber-600">
                {totalRecords > 0 ? ((anomalyCount / totalRecords) * 100).toFixed(2) : "0.00"}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Last Anomaly</h3>
              <p className="text-2xl font-bold text-gray-800">
                {anomalyData.length > 0 
                  ? format(parseISO(anomalyData[anomalyData.length - 1].datetime), 'MMM dd, HH:mm')
                  : 'None'}
              </p>
            </div>
          </div>

          {/* Feature Selection */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium mb-4">Feature Selection</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature
              </label>
              <select
                name="feature"
                value={filters.feature}
                onChange={handleFilterChange}
                className="border border-gray-300 rounded-md p-2 text-sm"
              >
                <option value="global_active_power">Global Active Power</option>
                <option value="global_reactive_power">Global Reactive Power</option>
                <option value="voltage">Voltage</option>
                <option value="global_intensity">Global Intensity</option>
                <option value="sub_metering_1">Sub Metering 1</option>
                <option value="sub_metering_2">Sub Metering 2</option>
                <option value="sub_metering_3">Sub Metering 3</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading data...</span>
            </div>
          ) : (
            <>
              {/* Main Chart */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">Power Consumption Over Time</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="datetime" 
                        tickFormatter={(value) => format(parseISO(value), 'MM/dd HH:mm')}
                        interval={Math.floor(data.length / 10)}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => format(parseISO(value), 'yyyy-MM-dd HH:mm:ss')}
                        formatter={(value, name) => {
                          if (name === filters.feature) return [value, filters.feature
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, c => c.toUpperCase())];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey={filters.feature} 
                        name={filters.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        stroke="#8884d8" 
                        dot={false} 
                        activeDot={{ r: 8 }}
                      />
                      {/* Scatter plot for anomalies */}
                      {anomalyData.length > 0 && (
                        <Scatter 
                          name="Anomalies" 
                          data={anomalyData} 
                          fill="red" 
                          line={false}
                          shape="circle"
                        >
                          {anomalyData.map((entry, index) => (
                            <Scatter 
                              key={`anomaly-${index}`} 
                              cx={entry.x} 
                              cy={entry.y} 
                              r={4} 
                              fill="red"
                            />
                          ))}
                        </Scatter>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Anomaly Score Distribution */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-4">Anomaly Score Distribution</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{
                        top: 20,
                        right: 20,
                        bottom: 20,
                        left: 20,
                      }}
                    >
                      <CartesianGrid />
                      <XAxis 
                        dataKey="anomaly_score"
                        domain={[-1, 1]}
                        name="Anomaly Score"
                        type="number"
                      />
                      <YAxis 
                        dataKey={filters.feature} 
                        name={filters.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} 
                        type="number"
                      />
                      <ZAxis range={[50, 400]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Legend />
                      <Scatter 
                        name="Power Consumption" 
                        data={data} 
                        fill="#8884d8"
                        shape="circle"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Anomalies Table */}
              {anomalyData.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow-sm overflow-x-auto">
                  <h3 className="text-lg font-medium mb-4">Recent Anomalies</h3>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Datetime
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {filters.feature
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, c => c.toUpperCase())}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Anomaly Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {anomalyData.slice(0, 5).map((item, index) => (
                        <tr key={`anomaly-row-${index}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(parseISO(item.datetime), 'yyyy-MM-dd HH:mm:ss')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item[filters.feature] !== undefined ? item[filters.feature].toFixed(2) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.anomaly_score.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <h3 className="text-xl font-medium text-gray-700">Please confirm the date range to view anomaly data</h3>
          <p className="text-gray-500 mt-2">Use the date selectors above and click "Confirm Date Range" to load data.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;