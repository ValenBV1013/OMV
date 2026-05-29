import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Captured:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[300px] bg-slate-900 rounded-xl p-8">
          <div className="text-center max-w-lg">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Error al cargar el mapa</h2>
            <p className="text-slate-400 text-sm mb-4">
              {this.state.error?.message || 'Ocurrió un error inesperado'}
            </p>
            <details className="text-left">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                Ver detalle técnico
              </summary>
              <pre className="mt-2 p-3 bg-slate-800 rounded-lg text-[10px] text-slate-400 overflow-auto max-h-[200px]">
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              Recargar módulo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
