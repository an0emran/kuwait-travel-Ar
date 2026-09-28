import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Error boundary for debugging
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', direction: 'rtl' }}>
                    <h1>حدث خطأ في التطبيق</h1>
                    <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
                        {this.state.error?.toString()}
                    </pre>
                    <button onClick={() => window.location.reload()}>إعادة تحميل الصفحة</button>
                </div>
            );
        }

        return this.props.children;
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </GoogleOAuthProvider>
        </ErrorBoundary>
    </StrictMode>,
)
