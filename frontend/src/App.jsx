import { useState } from 'react'
import axios from 'axios'
import MovieCard from './components/MovieCard'
import './theme.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRecommend = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { data } = await axios.get(`${BACKEND_URL}/recommend`, {
        params: { movie: query.trim() },
      })
      setResult(data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError(`Movie "${query}" not found. Please check the spelling.`)
      } else {
        setError('Something went wrong. Is the backend running on port 8000?')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 app-bg">
      {/* Hero */}
      <div className="text-center py-5 px-3 hero-section">
        <h1 className="display-5 fw-bold title-glow mb-1">
          🎬 Movie Recommendation System
        </h1>
        <p className="text-uppercase tracking-wide text-secondary mb-4" style={{ letterSpacing: '3px', fontSize: '0.75rem' }}>
          Discover your next favourite movie
        </p>

        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <input
            type="text"
            className="form-control search-input"
            style={{ maxWidth: '420px' }}
            placeholder="Enter a movie name (e.g. Avatar)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRecommend()}
          />
          <button
            className="btn btn-recommend"
            onClick={handleRecommend}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner-border spinner-border-sm me-2" /> Loading&hellip;</>
            ) : 'Recommend'}
          </button>
        </div>

        {error && (
          <div className="alert alert-danger mt-3 d-inline-block" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="container pb-5">
          <p className="section-label">You searched for</p>
          <div className="d-flex justify-content-center mb-5">
            <MovieCard title={result.movie.title} movieId={result.movie.movie_id} large />
          </div>

          <p className="section-label">Recommended Movies</p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            {result.recommendations.map((rec, idx) => (
              <MovieCard key={idx} title={rec.title} movieId={rec.movie_id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
