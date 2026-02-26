document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const contextInput = document.getElementById('contextInput');
    const loadingState = document.getElementById('loadingState');
    const resultsSection = document.getElementById('resultsSection');
    const reportContent = document.getElementById('reportContent');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentMarkdown = '';

    // Array of sophisticated loading messages to rotate
    const loadingMessages = [
        "Chief Strategy Agent is consulting specialists...",
        "Market Analyst is evaluating TAM and trends...",
        "Innovation Analyst mapping competitive landscape...",
        "Operations Analyst assessing value chain...",
        "Finance Analyst modelling unit economics...",
        "Synthesizing multi-dimensional insights...",
        "Finalizing strategic briefing document..."
    ];

    let messageInterval;

    analyzeBtn.addEventListener('click', async () => {
        const text = contextInput.value.trim();
        if (!text) {
            alert('Please define a business context first.');
            return;
        }

        // UI Reset
        resultsSection.classList.add('hidden');
        loadingState.classList.remove('hidden');
        analyzeBtn.disabled = true;

        let messageIndex = 0;
        const subtextEl = document.getElementById('loadingSubtext');
        subtextEl.innerText = loadingMessages[0];

        // Rotate loading text to keep user engaged during long generation
        messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            subtextEl.innerText = loadingMessages[messageIndex];
        }, 5000);

        try {
            // Note: Since this is served from the same Express instance, we can use a relative or absolute path to the same origin.
            // When running locally, it hits localhost. When on Cloud Run, it hits the Cloud Run URL.
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ business_context: text })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate report');
            }

            // Render Report
            currentMarkdown = data.report;
            // Use marked.js to parse the markdown string to HTML
            reportContent.innerHTML = marked.parse(currentMarkdown);

            // Show Results
            loadingState.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Scroll to results smoothly
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            alert(`Analysis Error: ${error.message}`);
            loadingState.classList.add('hidden');
        } finally {
            clearInterval(messageInterval);
            analyzeBtn.disabled = false;
        }
    });

    // Handle Markdown Download
    downloadBtn.addEventListener('click', () => {
        if (!currentMarkdown) return;

        const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');

        // Format filename based on date
        const dateString = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `VelocityCSO_Strategic_Report_${dateString}.md`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
});
