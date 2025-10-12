import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const DataVisualization = ({ data, title = "Data Visualization", userQuestion }) => {
  const [selectedChart, setSelectedChart] = useState('bar');
  const [availableCharts, setAvailableCharts] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState({});

  // Analyze data and determine suitable chart types
  useEffect(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      setAvailableCharts([]);
      return;
    }

    const analysis = analyzeData(data);
    
    // Only show charts if the data is actually suitable for visualization
    // Don't show charts for raw record samples, only for aggregated/summary data
    if (analysis.isSuitableForVisualization) {
      setAvailableCharts(analysis.availableCharts);
      // Set default chart to first available
      if (analysis.availableCharts.length > 0) {
        setSelectedChart(analysis.availableCharts[0]);
      }
    } else {
      setAvailableCharts([]);
    }
  }, [data]);

  // Generate chart data when chart type changes
  useEffect(() => {
    if (data && availableCharts.includes(selectedChart)) {
      const { chartData, chartOptions } = generateChartData(data, selectedChart);
      setChartData(chartData);
      setChartOptions(chartOptions);
    }
  }, [data, selectedChart, availableCharts]);

  const analyzeData = (data) => {
    if (!data || data.length === 0) return { availableCharts: [], isSuitableForVisualization: false };

    const columns = Object.keys(data[0]);
    const availableCharts = [];

    // Analyze each column to determine data types
    const columnAnalysis = columns.map(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
      const uniqueValues = [...new Set(values.map(String))];
      
      return {
        name: col,
        isNumeric: numericValues.length === values.length && values.length > 0,
        isCategorical: uniqueValues.length <= 20 && values.length > 0,
        isDate: values.some(val => !isNaN(Date.parse(val))),
        uniqueCount: uniqueValues.length,
        totalCount: values.length
      };
    });

    // Determine if data is suitable for visualization
    // Data is NOT suitable if:
    // 1. It looks like raw records (many unique values in most columns)
    // 2. It's a small sample of data (less than 5 rows)
    // 3. It has too many columns (looks like raw data table)
    
    const totalRows = data.length;
    const totalColumns = columns.length;
    const numericColumns = columnAnalysis.filter(col => col.isNumeric);
    const categoricalColumns = columnAnalysis.filter(col => col.isCategorical);
    
    // Check if this looks like raw record data vs aggregated data
    const hasManyUniqueValues = columnAnalysis.filter(col => col.uniqueCount > totalRows * 0.8).length;
    const isLikelyRawData = hasManyUniqueValues > totalColumns * 0.6;
    const isSmallSample = totalRows < 5;
    const isTooManyColumns = totalColumns > 8;
    
    // Special case: Perfect aggregated data (like "Category | Count" or "Region | Sales")
    const hasPerfectAggregation = totalColumns === 2 && 
      (categoricalColumns.length === 1 && numericColumns.length === 1) &&
      numericColumns[0].uniqueCount <= totalRows * 0.9; // Count column shouldn't have too many unique values
    
    // Check for summary/aggregated data patterns
    const hasSummaryPattern = categoricalColumns.some(col => 
      col.name.toLowerCase().includes('bucket') || 
      col.name.toLowerCase().includes('category') ||
      col.name.toLowerCase().includes('region') ||
      col.name.toLowerCase().includes('type') ||
      col.name.toLowerCase().includes('group')
    ) && numericColumns.some(col => 
      col.name.toLowerCase().includes('count') ||
      col.name.toLowerCase().includes('total') ||
      col.name.toLowerCase().includes('sum') ||
      col.name.toLowerCase().includes('average')
    );
    
    // Additional check: if user specifically asked for visualization, be more lenient
    const chartKeywords = /chart|graph|distribution|visualize|plot|show.*chart|create.*chart|display.*graph/i;
    const userWantsVisualization = userQuestion && chartKeywords.test(userQuestion);
    
    // Data is suitable for visualization if:
    // 1. It's perfect aggregated data (Category + Count pattern)
    // 2. It has summary patterns (buckets, categories with counts/totals)
    // 3. It has aggregated characteristics and reasonable size
    // 4. User specifically asked for visualization (be more lenient)
    // 5. It has the right data types for charts
    
    const isSuitableForVisualization = (hasPerfectAggregation || hasSummaryPattern || 
      (!isLikelyRawData && !isSmallSample && !isTooManyColumns) ||
      (userWantsVisualization && !isTooManyColumns && (numericColumns.length > 0 || categoricalColumns.length > 0))) && 
      (numericColumns.length > 0 || categoricalColumns.length > 0);

    // Only determine chart types if data is suitable
    if (isSuitableForVisualization) {
      
      // Bar Chart: Good for categorical data with numeric values
      // Perfect for distribution data like "Aging Bucket | Count"
      if (categoricalColumns.length > 0 && numericColumns.length > 0) {
        availableCharts.push('bar');
      }
      
      // Pie Chart: Good for categorical data with counts or percentages
      // Only if there are reasonable number of categories (2-10) and positive values
      if (categoricalColumns.length > 0 && numericColumns.length > 0) {
        const suitableCategoricalCol = categoricalColumns.find(col => 
          col.uniqueCount >= 2 && col.uniqueCount <= 10
        );
        if (suitableCategoricalCol) {
          availableCharts.push('pie');
        }
      }
      
      // Histogram: Good for numeric data distribution
      // Only if we have numeric data with enough variation
      if (numericColumns.length > 0) {
        const numericCol = numericColumns[0];
        const values = data.map(row => parseFloat(row[numericCol.name])).filter(val => !isNaN(val));
        const uniqueValues = [...new Set(values)];
        // Only show histogram if there's enough variation in numeric data
        if (uniqueValues.length > 5) {
          availableCharts.push('histogram');
        }
      }
      
      // Line Chart: For time series, sequential data, trends, or multiple numeric columns
      const hasDateColumn = columnAnalysis.some(col => col.isDate);
      const hasSequentialData = 
        columnAnalysis.some(col => col.name.toLowerCase().includes('time') || 
                                   col.name.toLowerCase().includes('date') ||
                                   col.name.toLowerCase().includes('month') ||
                                   col.name.toLowerCase().includes('year') ||
                                   col.name.toLowerCase().includes('day') ||
                                   col.name.toLowerCase().includes('quarter') ||
                                   col.name.toLowerCase().includes('week'));
      
      // Show line chart for:
      // 1. Time series data (dates/months)
      // 2. Multiple numeric columns with one categorical (like your data)
      // 3. NOT for single status/category data
      const isStatusData = categoricalColumns.some(col => 
        col.name.toLowerCase().includes('status') || 
        col.name.toLowerCase().includes('category') ||
        col.name.toLowerCase().includes('type') ||
        col.name.toLowerCase().includes('bucket')
      ) && numericColumns.length === 1;
      
      const hasMultipleNumericColumns = numericColumns.length >= 2;
      
      if ((hasDateColumn || hasSequentialData || hasMultipleNumericColumns) && !isStatusData) {
        availableCharts.push('line');
      }
    }

    return { 
      availableCharts, 
      columnAnalysis, 
      isSuitableForVisualization,
      analysis: {
        totalRows,
        totalColumns,
        isLikelyRawData,
        isSmallSample,
        isTooManyColumns,
        hasPerfectAggregation,
        hasSummaryPattern,
        numericColumns: numericColumns.length,
        categoricalColumns: categoricalColumns.length
      }
    };
  };

  const generateChartData = (data, chartType) => {
    const columns = Object.keys(data[0]);
    
    switch (chartType) {
      case 'bar':
        return generateBarChartData(data, columns);
      case 'line':
        return generateLineChartData(data, columns);
      case 'pie':
        return generatePieChartData(data, columns);
      case 'histogram':
        return generateHistogramData(data, columns);
      default:
        return { chartData: null, chartOptions: {} };
    }
  };

  const generateBarChartData = (data, columns) => {
    // Find categorical column for labels and numeric column for values
    const categoricalCol = columns.find(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined);
      const uniqueValues = [...new Set(values.map(String))];
      return uniqueValues.length <= 20 && values.length > 0;
    });

    const numericCol = columns.find(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      return values.length > 0 && values.every(val => !isNaN(parseFloat(val)) && isFinite(val));
    });

    if (!categoricalCol || !numericCol) {
      return { chartData: null, chartOptions: {} };
    }

    // Group data by categorical column and sum numeric values
    const groupedData = {};
    data.forEach(row => {
      const category = String(row[categoricalCol] || 'Unknown');
      const value = parseFloat(row[numericCol]) || 0;
      groupedData[category] = (groupedData[category] || 0) + value;
    });

    const labels = Object.keys(groupedData);
    const values = Object.values(groupedData);

    const chartData = {
      labels,
      datasets: [{
        label: `${numericCol} by ${categoricalCol}`,
        data: values,
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 205, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      }],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Bar Chart: ${numericCol} by ${categoricalCol}`,
          font: { size: 16 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    };

    return { chartData, chartOptions };
  };

  const generateLineChartData = (data, columns) => {
    // Find categorical column for x-axis labels
    const categoricalCol = columns.find(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined);
      const uniqueValues = [...new Set(values.map(String))];
      return uniqueValues.length > 1 && values.length > 0;
    });

    // Find all numeric columns for multiple lines
    const numericColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      return values.length > 0 && values.every(val => !isNaN(parseFloat(val)) && isFinite(val));
    });

    if (!categoricalCol || numericColumns.length === 0) {
      return { chartData: null, chartOptions: {} };
    }

    // Sort data by categorical column if it looks like dates/months
    let sortedData = [...data];
    const isDateLike = categoricalCol.toLowerCase().includes('month') || 
                       categoricalCol.toLowerCase().includes('date') ||
                       data.some(row => /[a-z]{3}\s+\d{4}/i.test(String(row[categoricalCol])));

    if (isDateLike) {
      sortedData.sort((a, b) => {
        const aVal = String(a[categoricalCol] || '');
        const bVal = String(b[categoricalCol] || '');
        
        // Try to parse as date first
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return aDate - bDate;
        }
        
        // If not parseable as date, sort alphabetically
        return aVal.localeCompare(bVal);
      });
    }

    // Use categorical column for x-axis labels
    const labels = sortedData.map(row => String(row[categoricalCol] || ''));
    
    // Create datasets for each numeric column
    const colors = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(255, 205, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ];

    const datasets = numericColumns.map((col, index) => {
      const values = sortedData.map(row => parseFloat(row[col]) || 0);
      
      return {
        label: col,
        data: values,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('1)', '0.1)'),
        tension: 0.1,
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    const chartData = {
      labels,
      datasets,
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Line Chart: ${numericColumns.join(', ')} by ${categoricalCol}`,
          font: { size: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    };

    return { chartData, chartOptions };
  };

  const generatePieChartData = (data, columns) => {
    // Find categorical column and numeric column
    const categoricalCol = columns.find(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined);
      const uniqueValues = [...new Set(values.map(String))];
      return uniqueValues.length <= 10 && uniqueValues.length > 1 && values.length > 0;
    });

    const numericCol = columns.find(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      return values.length > 0 && values.every(val => !isNaN(parseFloat(val)) && isFinite(val));
    });

    if (!categoricalCol || !numericCol) {
      return { chartData: null, chartOptions: {} };
    }

    // Use the numeric values, not row counts
    const labels = data.map(row => String(row[categoricalCol] || 'Unknown'));
    const values = data.map(row => parseFloat(row[numericCol]) || 0);

    const chartData = {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
          'rgba(199, 199, 199, 0.8)',
          'rgba(83, 102, 255, 0.8)',
          'rgba(255, 99, 255, 0.8)',
          'rgba(99, 255, 132, 0.8)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 205, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
          'rgba(83, 102, 255, 1)',
          'rgba(255, 99, 255, 1)',
          'rgba(99, 255, 132, 1)',
        ],
        borderWidth: 1,
      }],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Pie Chart: ${numericCol} by ${categoricalCol}`,
          font: { size: 16 }
        },
        legend: {
          position: 'right',
        },
      },
    };

    return { chartData, chartOptions };
  };

  const generateHistogramData = (data, columns) => {
    // Check if this is pre-binned histogram data (has range and count columns)
    const rangeColumn = columns.find(col => 
      col.toLowerCase().includes('range') || 
      col.toLowerCase().includes('bin') ||
      col.toLowerCase().includes('interval')
    );
    const countColumn = columns.find(col => 
      col.toLowerCase().includes('count') || 
      col.toLowerCase().includes('frequency')
    );

    if (rangeColumn && countColumn) {
      // This is pre-binned data - use it directly
      const labels = data.map(row => String(row[rangeColumn] || ''));
      const values = data.map(row => parseFloat(row[countColumn]) || 0);

      const chartData = {
        labels,
        datasets: [{
          label: `Frequency Distribution`,
          data: values,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        }],
      };

      const chartOptions = {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Histogram: Distribution`,
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          },
        },
      };

      return { chartData, chartOptions };
    }

    // Fallback to original logic for raw numeric data
    const numericColumns = columns.filter(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      return values.length > 0 && values.every(val => !isNaN(parseFloat(val)) && isFinite(val));
    });

    if (numericColumns.length === 0) {
      return { chartData: null, chartOptions: {} };
    }

    // Use first numeric column for histogram
    const col = numericColumns[0];
    const values = data.map(row => parseFloat(row[col]) || 0);

    // Create bins for histogram
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
    const binSize = (max - min) / binCount;

    const bins = [];
    const labels = [];
    
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      
      // Fix: Include the maximum value in the last bin
      let count;
      if (i === binCount - 1) {
        // Last bin: include values >= binStart and <= binEnd (includes max value)
        count = values.filter(v => v >= binStart && v <= binEnd).length;
      } else {
        // Other bins: include values >= binStart and < binEnd
        count = values.filter(v => v >= binStart && v < binEnd).length;
      }
      
      bins.push(count);
      labels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
    }

    const chartData = {
      labels,
      datasets: [{
        label: `Frequency Distribution of ${col}`,
        data: bins,
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      }],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Histogram: Distribution of ${col}`,
          font: { size: 16 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
      },
    };

    return { chartData, chartOptions };
  };

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg border">
        <h3 className="text-lg font-semibold mb-2">📊 Data Visualization</h3>
        <p className="text-gray-600">No data available for visualization.</p>
      </div>
    );
  }

  if (availableCharts.length === 0) {
    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">📊 Data Visualization</h3>
        <p className="text-blue-700">
          This data is not suitable for visualization with the available chart types.
        </p>
        <p className="text-sm text-blue-600 mt-2">
          💡 For better visualizations, try asking for:
        </p>
        <ul className="text-sm text-blue-600 mt-1 ml-4 list-disc">
          <li>Aggregated data: "Count by category" or "Sum by region"</li>
          <li>Time series: "Sales by month" or "Trends over time"</li>
          <li>Distributions: "Aging buckets" or "Status breakdown"</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 Data Visualization</h3>
        <div className="flex gap-2 flex-wrap">
          {availableCharts.map(chartType => {
            const getChartDescription = (type) => {
              switch(type) {
                case 'bar': return 'Bar Chart - Compare categories';
                case 'pie': return 'Pie Chart - Show proportions';
                case 'histogram': return 'Histogram - Show distribution';
                case 'line': return 'Line Chart - Show trends';
                default: return `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`;
              }
            };
            
            return (
              <button
                key={chartType}
                onClick={() => setSelectedChart(chartType)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedChart === chartType
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
                title={getChartDescription(chartType)}
              >
                {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
              </button>
            );
          })}
        </div>
      </div>

      {chartData && (
        <div className="bg-white p-4 rounded border">
          <div style={{ height: '400px', position: 'relative' }}>
            {selectedChart === 'bar' && <Bar data={chartData} options={chartOptions} />}
            {selectedChart === 'line' && <Line data={chartData} options={chartOptions} />}
            {selectedChart === 'pie' && <Pie data={chartData} options={chartOptions} />}
            {selectedChart === 'histogram' && <Bar data={chartData} options={chartOptions} />}
          </div>
        </div>
      )}

      {chartData === null && (
        <div className="bg-white p-4 rounded border text-center text-gray-500">
          Unable to generate {selectedChart} chart with this data.
        </div>
      )}
    </div>
  );
};

export default DataVisualization;
