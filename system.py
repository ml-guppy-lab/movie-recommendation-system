import ast

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
    vectors = cv.fit_transform(df['tags']).toarray()
    sim = cosine_similarity(vectors)

    return df, sim


print("Building recommendation model...")
_df, _similarity = _build_model()
print(f"Model ready. {len(_df)} movies loaded.")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="Movie Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/movies")
def list_movies():
    """Return all available movie titles (useful for autocomplete in the UI)."""
    return {"movies": _df['title'].tolist()}


@app.get("/recommend")
def recommend(movie: str):
    """Return 5 movie recommendations for a given title."""
    matches = _df[_df['title'].str.lower() == movie.lower()]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"Movie '{movie}' not found.")

    movie_index = matches.index[0]
    distances = _similarity[movie_index]
    top5 = sorted(enumerate(distances), key=lambda x: x[1], reverse=True)[1:6]
    recommendations = [_df.iloc[i[0]]['title'] for i in top5]

    return {"movie": _df.iloc[movie_index]['title'], "recommendations": recommendations}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("system:app", host="0.0.0.0", port=8000, reload=True)
