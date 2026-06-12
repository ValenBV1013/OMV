import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import toast from 'react-hot-toast'

export default function Login() {
  const { loginWithEmail, signUpWithEmail, loginWithProvider } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const validatePassword = (password) => {
    const minLength = 6
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasDigit = /\d/.test(password)
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    if (password.length < minLength) return `La contraseña debe tener al menos ${minLength} caracteres.`
    if (!hasLower) return 'Debe contener al menos una letra minúscula.'
    if (!hasUpper) return 'Debe contener al menos una letra mayúscula.'
    if (!hasDigit) return 'Debe contener al menos un número.'
    if (!hasSymbol) return 'Debe contener al menos un símbolo (!@#$%^&* etc.).'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    if (!isLogin && password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      setLoading(false)
      return
    }
    if (!isLogin) {
      const passwordError = validatePassword(password)
      if (passwordError) {
        toast.error(passwordError)
        setLoading(false)
        return
      }
    }
    try {
      if (isLogin) {
        await loginWithEmail(email, password)
        toast.success('Sesión iniciada correctamente')
      } else {
        await signUpWithEmail(email, password)
        toast.success('Registro exitoso. ¡Bienvenido!')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo con líneas de luz púrpura */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
          {/* Líneas radiales púrpuras */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-[2px] h-[600px] origin-bottom"
              style={{
                transform: `rotate(${i * 30}deg) translateY(-50%)`,
                background: 'linear-gradient(to top, transparent, rgba(168, 85, 247, 0.6), transparent)',
              }}
            />
          ))}
        </div>
        {/* Brillo central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-400/30 rounded-full blur-[80px]" />
      </div>

      {/* Tarjeta principal con forma angular */}
      <div className="relative w-full max-w-[420px]">
        {/* Efecto de brillo detrás de la tarjeta */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/40 via-transparent to-purple-900/40 rounded-[24px] blur-sm" />
        
        <div 
          className="relative bg-black/80 backdrop-blur-xl border border-purple-500/20 p-8"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 40px 100%, 0 calc(100% - 40px))',
            boxShadow: '0 0 60px rgba(168, 85, 247, 0.15), inset 0 0 60px rgba(168, 85, 247, 0.05)',
          }}
        >
          {/* Líneas decorativas de esquina */}
          <div className="absolute top-0 left-0 w-8 h-[1px] bg-purple-400/60" />
          <div className="absolute top-0 left-0 w-[1px] h-8 bg-purple-400/60" />
          <div className="absolute top-0 right-[40px] w-8 h-[1px] bg-purple-400/60" />
          <div className="absolute top-[40px] right-0 w-[1px] h-8 bg-purple-400/60" />
          <div className="absolute bottom-0 right-0 w-8 h-[1px] bg-purple-400/60" />
          <div className="absolute bottom-0 right-0 w-[1px] h-8 bg-purple-400/60" />
          <div className="absolute bottom-0 left-[40px] w-8 h-[1px] bg-purple-400/60" />
          <div className="absolute bottom-[40px] left-0 w-[1px] h-8 bg-purple-400/60" />

          {/* Logo */}
          <div className="mb-6">
            <h1 
              className="text-2xl font-bold tracking-wider text-white/90"
              style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.15em' }}
            >
              OMV
            </h1>
          </div>

          {/* Título */}
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-white">Iniciar sesión</h2>
            <p className="text-purple-300/50 text-[10px] mt-1 leading-relaxed max-w-[280px]">
              Ingresa a nuestra plataforma
            </p>
          </div>

          {/* Opciones Option 1 / Option 2 */}
          <div className="flex gap-3 mb-6 mt-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 border ${
                isLogin
                  ? 'bg-purple-900/40 border-purple-500/50 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'bg-purple-950/20 border-purple-500/20 text-purple-400/60 hover:border-purple-500/40'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 border ${
                !isLogin
                  ? 'bg-purple-900/40 border-purple-500/50 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'bg-purple-950/20 border-purple-500/20 text-purple-400/60 hover:border-purple-500/40'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Registrarse
            </button>
          </div>

          {/* Separador */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-purple-200/80 text-xs font-medium mb-2 ml-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-purple-950/30 border border-purple-500/30 rounded-full text-purple-100 text-sm placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all"
                placeholder="Ingresa tu correo electrónico"
                required
              />
            </div>

            <div>
              <label className="block text-purple-200/80 text-xs font-medium mb-2 ml-1">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-purple-950/30 border border-purple-500/30 rounded-full text-purple-100 text-sm placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all pr-10"
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/50 hover:text-purple-300/70 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-purple-200/80 text-xs font-medium mb-2 ml-1">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-purple-950/30 border border-purple-500/30 rounded-full text-purple-100 text-sm placeholder-purple-400/30 focus:outline-none focus:border-purple-400/60 focus:shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all"
                  placeholder="Confirma tu contraseña"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-100 hover:bg-white text-purple-900 font-semibold py-2.5 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
            >
              {loading ? 'Cargando...' : (isLogin ? 'Iniciar sesión' : 'Registrarse')}
            </button>
          </form>

          {/* Separador inferior */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            </div>
          </div>

          {/* Botón de GitHub */}
          <button
            onClick={() => loginWithProvider('github')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-purple-500/30 rounded-full hover:bg-purple-950/30 transition-all duration-300 text-purple-200/70 hover:text-purple-200 hover:border-purple-500/50"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.205 11.387.6.113.82-.26.82-.58 0-.287-.01-1.05-.015-2.06-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.082-.73.082-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.124-.3-.535-1.52.117-3.16 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.64.242 2.86.118 3.16.768.84 1.233 1.91 1.233 3.22 0 4.61-2.804 5.62-5.476 5.92.43.37.824 1.102.824 2.22 0 1.602-.015 2.894-.015 3.287 0 .322.216.698.83.578C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>
      </div>

      {/* Estrella decorativa */}
      <div className="absolute bottom-8 right-8 text-purple-400/30 animate-pulse">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
        </svg>
      </div>
    </div>
  )
}