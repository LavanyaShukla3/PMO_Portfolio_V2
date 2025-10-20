import React from 'react';
import '../styles/WelcomePage.css';

const WelcomePage = ({ onSelectView }) => {
    const views = [
        {
            id: 'Portfolio',
            title: 'Portfolio Roadmap',
            description: 'View all portfolios and their timelines',
            icon: '📊',
            color: 'blue'
        },
        {
            id: 'Program',
            title: 'Program Roadmap',
            description: 'View programs within portfolios',
            icon: '📈',
            color: 'green'
        },
        {
            id: 'SubProgram',
            title: 'Sub-Program Roadmap',
            description: 'View detailed sub-program timelines',
            icon: '📋',
            color: 'purple'
        },
        {
            id: 'Region',
            title: 'Region Roadmap',
            description: 'View roadmaps by region and department',
            icon: '🌍',
            color: 'orange'
        }
    ];

    return (
        <div className="welcome-container">
            <div className="welcome-header">
                <h1 className="welcome-title">PMO Portfolio Management</h1>
                <p className="welcome-subtitle">Select a view to get started</p>
            </div>

            <div className="view-grid">
                {views.map(view => (
                    <button
                        key={view.id}
                        className={`view-card view-card-${view.color}`}
                        onClick={() => onSelectView(view.id)}
                    >
                        <div className="view-icon">{view.icon}</div>
                        <h2 className="view-title">{view.title}</h2>
                        <p className="view-description">{view.description}</p>
                        <div className="view-action">Open View →</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WelcomePage;
