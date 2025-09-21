# PMO Portfolio Backend

Flask API server that connects to Azure Databricks and provides data endpoints for the PMO Portfolio React application.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Setup

The `.env` file is already configured with your Databricks credentials:

```
DATABRICKS_SERVER_HOSTNAME=adb-1944263524297370.10.azuredatabricks.net
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/2dd0b6935c0ba472
DATABRICKS_ACCESS_TOKEN=dapi6458498104f82b27fd9d7d705f318qwe
```

### 3. Test the Connection

```bash
python test_backend.py
```

This will test:
- ✅ Databricks connection
- ✅ SQL query execution
- ✅ Flask server endpoints
- ✅ Data retrieval

### 4. Start the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and version info.

### Test Connection
```
GET /api/test-connection
```
Tests the Databricks connection.

### Hierarchy Data
```
GET /api/hierarchy_data
```
Returns hierarchy data (equivalent to portfolioData.json, ProgramData.json, etc.)

### Investment Data
```
GET /api/investment_data
```
Returns investment/roadmap data (equivalent to investmentData.json)

### All Data
```
GET /api/data
```
Returns both hierarchy and investment data in a single request.

## 📁 Project Structure

```
backend/
├── app.py                    # Main Flask application
├── databricks_client.py      # Databricks connection handler
├── test_backend.py          # Test suite
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (configured)
├── .env.example            # Environment template
└── sql_queries/
    ├── hierarchy_query.sql  # Hierarchy data SQL query
    └── investment_query.sql # Investment data SQL query
```

## 🔧 Configuration

### Environment Variables

- `DATABRICKS_SERVER_HOSTNAME`: Your Databricks server hostname
- `DATABRICKS_HTTP_PATH`: SQL warehouse HTTP path
- `DATABRICKS_ACCESS_TOKEN`: Personal Access Token for authentication
- `FLASK_ENV`: Flask environment (development/production)
- `FLASK_DEBUG`: Enable/disable debug mode
- `FRONTEND_URL`: React frontend URL for CORS

### SQL Queries

The SQL queries are stored in the `sql_queries/` directory:

- `hierarchy_query.sql`: Based on "Clarity Roadmaps - Hierarchy data - SQL query 1.txt"
- `investment_query.sql`: Based on "Clarity Roadmaps - Roadmap elements by investment - SQL query - As at 20250604 1.txt"

## 🧪 Testing

Run the test suite to verify everything is working:

```bash
python test_backend.py
```

The tests will check:
1. Databricks connection
2. SQL query execution
3. Flask server health
4. Data endpoint functionality

## 🔒 Security

- Credentials are stored in environment variables (not hardcoded)
- CORS is configured for your React frontend
- Access tokens are used for secure Databricks authentication

## 🐛 Troubleshooting

### Connection Issues
- Verify your Databricks credentials in `.env`
- Check that your SQL warehouse is running
- Ensure your Personal Access Token is valid

### Query Issues
- Check the SQL query files in `sql_queries/`
- Verify table permissions in Databricks
- Check Databricks logs for SQL errors

### CORS Issues
- Update `FRONTEND_URL` in `.env` to match your React app URL
- Restart the Flask server after changing environment variables

## 📊 Data Flow

```
React Frontend → Flask API → Databricks SQL Warehouse → Unity Catalog Tables
```

1. React app makes HTTP requests to Flask endpoints
2. Flask server executes SQL queries against Databricks
3. Databricks returns data from Unity Catalog tables
4. Flask formats and returns JSON data to React
5. React processes data the same way as before (but now live data!)

## 🚀 Next Steps

After verifying the backend works:

1. **Test with Postman/Browser**: Visit `http://localhost:5000/api/health`
2. **Run Full Test Suite**: `python test_backend.py`
3. **Integrate with Frontend**: Update React components to use API endpoints
4. **Production Deployment**: Configure for your production environment
