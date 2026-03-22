import { useState, useEffect } from 'react'

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

function MovieCard({ title, movieId, large }) {
  const [posterUrl, setPosterUrl] = useState(null)

  useEffect(() => {
    if (!TMDB_KEY || !movieId) return
    fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.poster_path) setPosterUrl(`${TMDB_IMG}${data.poster_path}`)
      })
      .catch(() => {})
  }, [movieId])

  const width = large ? 210 : 160

  return (
    <div className={`movie-card text-center${large ? ' movie-card-large' : ''}`} style={{ width }}>
      <div className="poster-wrapper rounded-3 overflow-hidden mb-2">
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="img-fluid w-100 h-100 object-fit-cover" />
        ) : (
          <div className="poster-placeholder d-flex flex-column align-items-center justify-content-center h-100 p-3">
            <span style={{ fontSize: '2.5rem', opacity: 0.4 }}>🎬</span>
            <small className="text-secondary mt-2" style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{title}</small>
          </div>
        )}
      </div>
      <p className={`movie-title mb-0${large ? ' movie-title-large' : ''}`}>{title}</p>
    </div>
  )
}

export default MovieCard
