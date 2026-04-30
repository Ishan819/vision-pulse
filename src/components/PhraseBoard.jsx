const PHRASE_GROUPS = [
  {
    key: 'needs',
    title: 'Basic Needs',
    icon: 'BN',
    phrases: ['hurt', 'please', 'more', 'eat', 'drink', 'water', 'milk', 'hungry', 'bathroom'],
  },
  {
    key: 'actions',
    title: 'Actions',
    icon: 'AC',
    phrases: ['help', 'stop', 'wait', 'ready', 'all done', 'change'],
  },
  {
    key: 'feelings',
    title: 'Feelings',
    icon: 'FE',
    phrases: ['happy', 'tired', 'hot', 'cold'],
  },
  {
    key: 'daily',
    title: 'Daily',
    icon: 'DY',
    phrases: ['bath', 'bed', 'good morning', 'good night'],
  },
  {
    key: 'social',
    title: 'Social',
    icon: 'SO',
    phrases: ['thank you', 'yes', 'no', 'I love you'],
  },
]

function PhraseBoard({ onSpeakPhrase }) {
  return (
    <section className="phrase-panel" aria-label="Common sign phrases">
      <header className="panel-header">
        <h2>Quick Phrases</h2>
        <span className="badge">Tap To Speak</span>
      </header>

      <div className="phrase-groups">
        {PHRASE_GROUPS.map((group, index) => (
          <details key={group.key} className="phrase-group" open={index < 2}>
            <summary>
              <span className="group-icon" aria-hidden="true">
                {group.icon}
              </span>
              <span>{group.title}</span>
            </summary>

            <div className="phrase-chips" role="list">
              {group.phrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  className="phrase-chip"
                  onClick={() => onSpeakPhrase(phrase)}
                >
                  {phrase}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

export default PhraseBoard
