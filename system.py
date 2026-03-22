import ast
import os
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import nltk
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# ── Helpers ───────────────────────────────────────────────────────────────────

def _convert(obj):
    return [i['name'] for i in ast.literal_eval(obj)]

def _convert3(obj):
    return [i['name'] for i in ast.literal_eval(obj)][:3]

def _fetch_director(obj):
    return [i['name'] for i in ast.literal_eval(obj) if i['job'] == 'Director']

_ps = PorterStemmer()

def _stem(text: str) -> str:
    return " ".join(_ps.stem(word) for word in text.split())


# ── Build model at startup ────────────────────────────────────────────────────

def _build_model():
    movies = pd.read_csv('datasets/tmdb_5000_movies.csv')
    credits = pd.read_csv('datasets/tmdb_5000_credits.csv')

    movies = movies.merge(credits, on='title')
    movies = movies[['movie_id', 'title', 'overview', 'genres', 'keywords', 'cast', 'crew']]
    movies.dropna(inplace=True)

    movies['genres']   = movies['genres'].apply(_convert)
    movies['keywords'] = movies['keywords'].apply(_convert)
    movies['cast']     = movies['cast'].apply(_convert3)
    movies['crew']     = movies['crew'].apply(_fetch_director)
    movies['overview'] = movies['overview'].apply(lambda x: x.split())

    for col in ['genres', 'keywords', 'cast', 'crew']:
        movies[col] = movies[col].apply(lambda x: [i.replace(" ", "") for i in x])

    movies['tags'] = (
        movies['overview'] + movies['genres'] +
        movies['keywords'] + movies['cast'] + movies['crew']
    )

    df = movies[['movie_id', 'title', 'tags']].copy()
    df['tags'] = (df['tags']
                  .apply(lambda x: " ".join(x))
                  .apply(lambda x: x.lower())
                  .apply(_stem))

    cv = CountVectorizer(max_features=5000, stop_words='english')
    # float32 halves memory vs float64
    vectors = cv.fit_transform(df['tags']).toarray().astype('float32')
    sim = cosine_similarity(vectors)
    del vectors  # free immediately

    # Precompute top-5 indices for every movie, then discard full matrix
    top5_map = {}
    for idx in range(len(df)):
        top5_map[idx] = [
            i for i, _ in
            sorted(enumerate(sim[idx]), key=lambda x: x[1], reverse=True)[1:6]
        ]
    del sim  # full matrix no longer needed

    df = df.reset_index(drop=True)
    return df, top5_map


# ── App state ────────────────────────────────────────────────────────────────

_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs after the port is open — Render won't time out waiting
    print("Building recommendation model...")
    _state['df'], _state['top5_map'] = _build_model()
    print(f"Model ready. {len(_state['df'])} movies loaded.")
    yield
    _state.clear()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="Movie Recommender API", lifespan=lifespan)

# CORS — set ALLOWED_ORIGINS env var in production (comma-separated URLs)
# e.g. https://your-frontend.onrender.com,https://your-custom-domain.com
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
if not _origins:
    _origins = ["*"]  # fallback for local dev

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/movies")
def list_movies():
    """Return all available movie titles (useful for autocomplete in the UI)."""
    return {"movies": _state['df']['title'].tolist()}


@app.get("/recommend")
def recommend(movie: str):
    """Return 5 movie recommendations for a given title."""
    df = _state['df']
    top5_map = _state['top5_map']
    matches = df[df['title'].str.lower() == movie.lower()]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"Movie '{movie}' not found.")

    movie_index = matches.index[0]
    top5_indices = top5_map[movie_index]
    recommendations = [
        {"title": df.iloc[i]['title'], "movie_id": int(df.iloc[i]['movie_id'])}
        for i in top5_indices
    ]

    return {
        "movie": {
            "title": df.iloc[movie_index]['title'],
            "movie_id": int(df.iloc[movie_index]['movie_id'])
        },
        "recommendations": recommendations
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("system:app", host="0.0.0.0", port=8000, reload=True)
