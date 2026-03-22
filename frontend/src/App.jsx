import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import MovieCard from './components/MovieCard'
import './theme.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [allTitles, setAllTitles] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)

  // Fetch all movie titles once on mount
  useEffect(() => {
    axios.get(`${BACKEND_URL}/movies`)
      .then(({ data }) => setAllTitles(data.movies))
      .catch(() => {})
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)
    if (val.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const lower = val.toLowerCase()
    const matches = allTitles
      .filter((t) => t.toLowerCase().includes(lower))
      .slice(0, 8)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  const selectSuggestion = (title) => {
    setQuery(title)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleRecommend()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) {
        selectSuggestion(suggestions[activeIndex])
      } else {
        setShowSuggestions(false)
        handleRecommend()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleRecommend = async (overrideQuery) => {
    const q = (overrideQuery || query).trim()
    if (!q) return
    setLoading(true)
    setError('')
    setResult(null)
    setShowSuggestions(false)
    try {
      const { data } = await axios.get(`${BACKEND_URL}/recommend`, {
        params: { movie: q },
      })
      setResult(data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError(`Movie "${q}" not found. Please check the spelling.`)
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
          <div className="autocomplete-wrapper" ref={wrapperRef}>
            <input
              type="text"
              className="form-control search-input"
              placeholder="Enter a movie name (e.g. Avatar)"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {showSuggestions && (
              <ul className="autocomplete-list">
                {suggestions.map((title, idx) => (
                  <li
                    key={title}
                    className={`autocomplete-item${idx === activeIndex ? ' active' : ''}`}
                    onMouseDown={() => selectSuggestion(title)}
                  >
                    {title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            className="btn btn-recommend"
            onClick={() => handleRecommend()}
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
