function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function ThumbnailCard({ thumb, index, videoId }) {
  return React.createElement("div", {
    style: {
      borderRadius: 16, overflow: "hidden", background: "#0f0f0f",
      border: "1px solid #2a2a2a", marginBottom: 16,
    }
  },
    React.createElement("div", {
      style: {
        position: "relative", aspectRatio: "16/9",
        background: thumb.bgGradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", padding: 20,
      }
    },
      React.createElement("span", { style: { fontSize: 40 } }, thumb.emoji),
      React.createElement("div", {
        style: {
          fontSize: 18, fontWeight: 900, color: "#fff",
          textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          textAlign: "center", marginTop: 8, fontFamily: "Georgia, serif",
        }
      }, thumb.textOverlay),
      React.createElement("div", {
        style: {
          position: "absolute", top: 10, right: 10,
          background: "rgba(0,0,0,0.7)", color: "#fff",
          padding: "3px 8px", borderRadius: 6, fontSize: 11,
        }
      }, "#" + (index + 1))
    ),
    React.createElement("div", { style: { padding: "14px 16px" } },
      React.createElement("div", {
        style: { color: "#ff4545", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }
      }, thumb.style),
      React.createElement("div", { style: { color: "#ccc", fontSize: 13 } }, thumb.description),
      React.createElement("div", { style: { color: "#666", fontSize: 11, marginTop: 6, fontStyle: "italic" } }, thumb.colorScheme)
    )
  );
}

function App() {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [videoMeta, setVideoMeta] = React.useState(null);
  const [videoId, setVideoId] = React.useState(null);
  const [error, setError] = React.useState(null);

  async function fetchVideoMeta(id) {
    const res = await fetch(
      "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + id + "&format=json"
    );
    if (!res.ok) throw new Error("Could not fetch video info");
    return res.json();
  }

  async function fetchTranscript(id) {
    try {
      const res = await fetch("https://tactiq-apps-prod.tactiq.io/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: "https://www.youtube.com/watch?v=" + id, language: "en" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.captions?.length) return data.captions.map(c => c.text).join(" ");
      }
    } catch (_) {}
    return null;
  }

  async function analyzeWithClaude(title, author, transcript) {
    const prompt = `You are a YouTube video analyzer. Analyze this video and respond ONLY with valid JSON, no markdown, no backticks.

Video Title: ${title}
Channel: ${author}
${transcript ? "Transcript (first 2000 chars):\n" + transcript.slice(0, 2000) : "[No transcript available]"}

Respond with this exact JSON structure:
{
  "topic": "Main topic in 1 sentence",
  "category": "Category (Tech/Education/Entertainment/Gaming/Music/News/Sports etc)",
  "summary": "3-4 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4"],
  "detectedPerson": {
    "found": true or false,
    "name": "Person name or null",
    "role": "Their role or null",
    "confidence": "high/medium/low"
  },
  "sentiment": "Positive/Negative/Neutral/Informative/Entertaining",
  "targetAudience": "Who this is for",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "thumbnailSuggestions": [
    {
      "style": "Bold Text Overlay",
      "description": "Describe the thumbnail",
      "textOverlay": "Main text for thumbnail",
      "colorScheme": "Color description",
      "emoji": "one relevant emoji",
      "bgGradient": "linear-gradient(135deg, #1a1a2e, #16213e)"
    },
    {
      "style": "Face + Text",
      "description": "Describe the thumbnail",
      "textOverlay": "Catchy hook text",
      "colorScheme": "Color description",
      "emoji": "one relevant emoji",
      "bgGradient": "linear-gradient(135deg, #c0392b, #8e44ad)"
    },
    {
      "style": "Curiosity Gap",
      "description": "Describe the thumbnail",
      "textOverlay": "Question or cliffhanger",
      "colorScheme": "Color description",
      "emoji": "one relevant emoji",
      "bgGradient": "linear-gradient(135deg, #f39c12, #e74c3c)"
    },
    {
      "style": "Minimal Clean",
      "description": "Describe the thumbnail",
      "textOverlay": "Clean direct title",
      "colorScheme": "Color description",
      "emoji": "one relevant emoji",
      "bgGradient": "linear-gradient(135deg, #2ecc71, #1abc9c)"
    }
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  async function handleAnalyze() {
    setError(null);
    setResult(null);
    setVideoMeta(null);
    const id = extractVideoId(url.trim());
    if (!id) { setError("❌ Invalid YouTube URL. Please paste a valid YouTube link."); return; }
    setVideoId(id);
    setLoading(true);
    try {
      setStep("🔍 Fetching video info...");
      const meta = await fetchVideoMeta(id);
      setVideoMeta(meta);
      setStep("📝 Fetching transcript...");
      const transcript = await fetchTranscript(id);
      setStep("🤖 AI is analyzing...");
      const analysis = await analyzeWithClaude(meta.title, meta.author_name, transcript);
      setResult({ analysis, hasTranscript: !!transcript });
    } catch (err) {
      setError("⚠️ " + (err.message || "Something went wrong. Try again."));
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  const thumbUrl = videoId ? "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg" : null;

  return React.createElement("div", {
    style: { minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "Georgia, serif" }
  },
    // Header
    React.createElement("div", {
      style: { background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", padding: "28px 20px", textAlign: "center" }
    },
      React.createElement("h1", {
        style: { fontSize: 36, fontWeight: 900, margin: "0 0 6px", letterSpacing: -2 }
      },
        React.createElement("span", { style: { color: "#ff4545" } }, "YT"),
        React.createElement("span", null, "Vision"),
        React.createElement("span", { style: { color: "#444" } }, ".ai")
      ),
      React.createElement("p", { style: { color: "#666", margin: 0, fontSize: 14 } },
        "Paste a YouTube link → AI detects topic, person & generates thumbnails"
      )
    ),

    // Main content
    React.createElement("div", { style: { maxWidth: 700, margin: "0 auto", padding: "24px 16px" } },

      // Input box
      React.createElement("div", {
        style: { background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 20 }
      },
        React.createElement("div", { style: { color: "#888", fontSize: 12, fontFamily: "monospace", marginBottom: 8 } }, "PASTE YOUTUBE LINK"),
        React.createElement("input", {
          value: url,
          onChange: e => setUrl(e.target.value),
          placeholder: "https://youtube.com/watch?v=...",
          style: {
            width: "100%", background: "#181818", border: "1px solid #333",
            borderRadius: 10, padding: "12px 14px", color: "#fff",
            fontSize: 14, fontFamily: "monospace", outline: "none",
            boxSizing: "border-box", marginBottom: 12,
          }
        }),
        React.createElement("button", {
          onClick: handleAnalyze,
          disabled: loading || !url.trim(),
          style: {
            width: "100%", background: loading ? "#333" : "linear-gradient(135deg, #ff4545, #c0392b)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "14px", fontWeight: 700, fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace",
          }
        }, loading ? "⏳ " + step : "⚡ ANALYZE VIDEO"),

        error && React.createElement("div", {
          style: { marginTop: 12, padding: "12px", background: "rgba(255,0,0,0.05)", borderRadius: 8, color: "#ff6060", fontSize: 13, border: "1px solid rgba(255,0,0,0.2)" }
        }, error)
      ),

      // Video meta
      videoMeta && React.createElement("div", {
        style: { background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: 16, marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }
      },
        thumbUrl && React.createElement("img", { src: thumbUrl, alt: "thumb", style: { width: 120, borderRadius: 8, flexShrink: 0 } }),
        React.createElement("div", null,
          React.createElement("div", { style: { color: "#ff4545", fontSize: 11, fontFamily: "monospace", marginBottom: 4 } }, "VIDEO FOUND ✓"),
          React.createElement("div", { style: { fontWeight: 700, fontSize: 16, lineHeight: 1.3, marginBottom: 4 } }, videoMeta.title),
          React.createElement("div", { style: { color: "#888", fontSize: 13 } }, "📺 " + videoMeta.author_name),
          result && React.createElement("div", { style: { marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" } },
            React.createElement("span", { style: { background: "rgba(255,69,69,0.15)", color: "#ff7070", padding: "2px 10px", borderRadius: 100, fontSize: 12 } }, result.analysis.category),
            React.createElement("span", { style: { background: "rgba(255,255,255,0.05)", color: "#aaa", padding: "2px 10px", borderRadius: 100, fontSize: 12 } }, result.analysis.sentiment),
            React.createElement("span", { style: { background: result.hasTranscript ? "rgba(0,200,100,0.1)" : "rgba(255,200,0,0.1)", color: result.hasTranscript ? "#4ecca3" : "#ffd700", padding: "2px 10px", borderRadius: 100, fontSize: 12 } }, result.hasTranscript ? "✓ Transcript" : "⚠ No transcript")
          )
        )
      ),

      // Results
      result && React.createElement("div", null,

        // Topic & Summary
        React.createElement("div", { style: { background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 16 } },
          React.createElement("div", { style: { color: "#ff4545", fontSize: 11, fontFamily: "monospace", marginBottom: 8 } }, "🎯 MAIN TOPIC"),
          React.createElement("div", { style: { fontSize: 17, fontWeight: 700, marginBottom: 10 } }, result.analysis.topic),
          React.createElement("div", { style: { color: "#bbb", fontSize: 14, lineHeight: 1.7 } }, result.analysis.summary)
        ),

        // Person detection
        React.createElement("div", {
          style: {
            background: result.analysis.detectedPerson?.found ? "rgba(78,204,163,0.05)" : "#0f0f0f",
            border: result.analysis.detectedPerson?.found ? "1px solid rgba(78,204,163,0.3)" : "1px solid #2a2a2a",
            borderRadius: 16, padding: 20, marginBottom: 16,
          }
        },
          React.createElement("div", { style: { color: "#4ecca3", fontSize: 11, fontFamily: "monospace", marginBottom: 10 } }, "👤 PERSON DETECTION"),
          result.analysis.detectedPerson?.found
            ? React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 700 } }, "🙂 " + (result.analysis.detectedPerson.name || "Person detected")),
                result.analysis.detectedPerson.role && React.createElement("div", { style: { color: "#888", fontSize: 13, marginTop: 4 } }, result.analysis.detectedPerson.role),
                React.createElement("div", { style: { marginTop: 8, color: "#4ecca3", fontSize: 12 } }, "Confidence: " + result.analysis.detectedPerson.confidence)
              )
            : React.createElement("div", { style: { color: "#666", fontSize: 14 } }, "🎭 No specific person detected (may be faceless/animated channel)")
        ),

        // Key Points
        React.createElement("div", { style: { background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 16 } },
          React.createElement("div", { style: { color: "#ff4545", fontSize: 11, fontFamily: "monospace", marginBottom: 12 } }, "📌 KEY POINTS"),
          result.analysis.keyPoints?.map((point, i) =>
            React.createElement("div", { key: i, style: { display: "flex", gap: 10, marginBottom: 10, color: "#ccc", fontSize: 14, lineHeight: 1.5 } },
              React.createElement("span", { style: { color: "#ff4545", fontWeight: 700 } }, (i + 1) + "."),
              point
            )
          )
        ),

        // Tags
        React.createElement("div", { style: { background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 20 } },
          React.createElement("div", { style: { color: "#888", fontSize: 11, fontFamily: "monospace", marginBottom: 10 } }, "🏷 TAGS"),
          React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
            result.analysis.tags?.map((tag, i) =>
              React.createElement("span", { key: i, style: { background: "#1a1a1a", border: "1px solid #333", color: "#aaa", padding: "4px 12px", borderRadius: 100, fontSize: 12 } }, "#" + tag)
            )
          )
        ),

        // Thumbnails
        React.createElement("div", { style: { marginBottom: 24 } },
          React.createElement("div", { style: { textAlign: "center", color: "#ff4545", fontSize: 13, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 } }, "🖼 AI THUMBNAIL CONCEPTS"),
          result.analysis.thumbnailSuggestions?.map((thumb, i) =>
            React.createElement(ThumbnailCard, { key: i, thumb, index: i, videoId })
          )
        )
      ),

      // Footer
      React.createElement("div", { style: { textAlign: "center", color: "#333", fontSize: 12, fontFamily: "monospace", paddingBottom: 24 } },
        "Free · No API key needed · Powered by Claude AI"
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));first commit