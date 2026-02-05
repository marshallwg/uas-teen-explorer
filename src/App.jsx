import React, { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ErrorBar
} from 'recharts'

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#be185d', '#065f46'
]

function App() {
  const [summaries, setSummaries] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [selectedDemographic, setSelectedDemographic] = useState('Overall')
  const [selectedView, setSelectedView] = useState('items')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('./data/summaries.json').then(r => r.json()),
      fetch('./data/metadata.json').then(r => r.json())
    ])
      .then(([summariesData, metadataData]) => {
        setSummaries(summariesData)
        setMetadata(metadataData)
        setLoading(false)
      })
      .catch(err => {
        setError('Failed to load data. Please run the R scripts first.')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <div className="instructions">
          <h3>To generate the data:</h3>
          <ol>
            <li>Open R or RStudio</li>
            <li>Set working directory to the project folder</li>
            <li>Run: <code>source("run_all.R")</code></li>
            <li>Run: <code>source("scripts/05_export_dashboard_data.R")</code></li>
            <li>Refresh this page</li>
          </ol>
        </div>
      </div>
    )
  }

  // Filter data based on selections
  const filteredData = summaries.filter(d => d.demographic === selectedDemographic)

  // Separate items and scale scores
  const itemData = filteredData.filter(d =>
    metadata.score_types.items.includes(d.item)
  )
  const scaleData = filteredData.filter(d =>
    metadata.score_types.scales.includes(d.item)
  )

  // Get unique groups for the selected demographic
  const groups = [...new Set(filteredData.map(d => d.group))]

  // Prepare chart data
  const prepareChartData = (data) => {
    const items = [...new Set(data.map(d => d.item))]
    return items.map(item => {
      const itemRows = data.filter(d => d.item === item)
      const row = {
        item: item,
        label: itemRows[0]?.item_label || item
      }
      itemRows.forEach(r => {
        row[r.group] = r.mean
        row[`${r.group}_ci`] = [r.ci_lower, r.ci_upper]
        row[`${r.group}_n`] = r.n
        row[`${r.group}_sd`] = r.sd
      })
      return row
    })
  }

  const chartData = selectedView === 'items'
    ? prepareChartData(itemData)
    : prepareChartData(scaleData)

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null

    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="tooltip-row">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="tooltip-value">
              {entry.value?.toFixed(2)}
              {entry.payload[`${entry.name}_n`] && (
                <span className="tooltip-n">
                  (n={entry.payload[`${entry.name}_n`]})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Teen Personality Traits Dashboard</h1>
        <p className="subtitle">
          Explore means by demographic subgroups (N = {metadata.sample_size})
        </p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="demographic">Group By:</label>
          <select
            id="demographic"
            value={selectedDemographic}
            onChange={e => setSelectedDemographic(e.target.value)}
          >
            {metadata.demographics.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>View:</label>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${selectedView === 'items' ? 'active' : ''}`}
              onClick={() => setSelectedView('items')}
            >
              Individual Items
            </button>
            <button
              className={`toggle-btn ${selectedView === 'scales' ? 'active' : ''}`}
              onClick={() => setSelectedView('scales')}
            >
              Scale Scores
            </button>
          </div>
        </div>
      </div>

      <main className="main-content">
        <section className="chart-section">
          <h2>
            {selectedView === 'items' ? 'Item Means' : 'Scale Score Means'}
            {selectedDemographic !== 'Overall' && ` by ${selectedDemographic}`}
          </h2>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={selectedView === 'items' ? [1, 5] : ['auto', 'auto']}
                  tickFormatter={v => v.toFixed(1)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {groups.map((group, index) => (
                  <Bar
                    key={group}
                    dataKey={group}
                    name={group}
                    fill={COLORS[index % COLORS.length]}
                    barSize={groups.length > 4 ? 12 : 20}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="table-section">
          <h2>Summary Statistics</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  {groups.map(g => (
                    <th key={g} colSpan={3}>{g}</th>
                  ))}
                </tr>
                <tr>
                  <th></th>
                  {groups.map(g => (
                    <React.Fragment key={g}>
                      <th className="subheader">N</th>
                      <th className="subheader">Mean</th>
                      <th className="subheader">SD</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map(row => (
                  <tr key={row.item}>
                    <td className="item-label">{row.label}</td>
                    {groups.map(g => (
                      <React.Fragment key={g}>
                        <td className="stat-cell">
                          {row[`${g}_n`] || '-'}
                        </td>
                        <td className="stat-cell mean">
                          {row[g]?.toFixed(2) || '-'}
                        </td>
                        <td className="stat-cell">
                          {row[`${g}_sd`]?.toFixed(2) || '-'}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedDemographic !== 'Overall' && (
          <section className="notes-section">
            <h3>Notes</h3>
            <ul>
              <li>
                Error bars represent 95% confidence intervals
              </li>
              <li>
                Items are scored on a 1-5 Likert scale
                (1 = Strongly Disagree, 5 = Strongly Agree)
              </li>
              <li>
                Reverse-coded items are marked with [REVERSED] in the full labels
              </li>
              {groups.some(g => {
                const gData = filteredData.filter(d => d.group === g)
                return gData.length > 0 && gData[0].n < 30
              }) && (
                <li className="warning">
                  Some subgroups have small sample sizes (n &lt; 30).
                  Interpret with caution.
                </li>
              )}
            </ul>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          Teen Personality Traits Analysis | CESR Education Data Team |
          University of Southern California
        </p>
      </footer>
    </div>
  )
}

export default App
