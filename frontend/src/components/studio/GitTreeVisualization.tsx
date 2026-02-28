import React, { useEffect, useState, useRef } from 'react';
import type { GitVisualization, Commit } from '../../lib/studio/types';

interface GitTreeVisualizationProps {
  onBranchSelect?: (branch: string) => void;
  onCommitSelect?: (commit: Commit, branch: string) => void;
  currentBranch?: string;
}

export const GitTreeVisualization: React.FC<GitTreeVisualizationProps> = ({
  onBranchSelect,
  onCommitSelect,
  currentBranch = 'main'
}) => {
  const [gitData, setGitData] = useState<GitVisualization | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranch);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGitData();
  }, []);

  useEffect(() => {
    if (gitData) {
      drawGitTree();
    }
  }, [gitData, selectedBranch, hoveredCommit]);

  const loadGitData = async () => {
    try {
      const response = await fetch('/api/studio/git-tree');
      const data = await response.json();
      setGitData(data);
    } catch (error) {
      console.error('Failed to load git tree:', error);
      // Fallback to mock data for development
      setGitData({
        branches: [
          {
            name: 'main',
            commits: [
              { id: 'abc123', message: 'Initial ingestion', timestamp: '2024-02-28T10:00:00', author: 'system' },
              { id: 'def456', message: 'Scene 5 camera update', timestamp: '2024-02-28T11:00:00', author: 'director' }
            ]
          },
          {
            name: 'what-if/marcus-confronts-jane',
            parent: 'main',
            commits: [
              { id: 'abc123', message: 'Initial ingestion', timestamp: '2024-02-28T10:00:00', author: 'system' },
              { id: 'def456', message: 'Scene 5 camera update', timestamp: '2024-02-28T11:00:00', author: 'director' },
              { id: 'ghi789', message: 'Marcus confronts Jane directly', timestamp: '2024-02-28T12:00:00', author: 'director' }
            ]
          }
        ],
        currentBranch: currentBranch,
        mainBranch: 'main'
      });
    }
  };

  const drawGitTree = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !gitData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = Math.max(400, gitData.branches.length * 100);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configuration
    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    // Colors
    const colors = {
      main: '#10b981',
      whatif: '#3b82f6',
      selected: '#f59e0b',
      commit: '#6b7280',
      commitHover: '#1f2937',
      line: '#e5e7eb',
      text: '#374151',
      label: '#111827'
    };

    // Draw branches
    gitData.branches.forEach((branch, branchIndex) => {
      const y = topMargin + branchIndex * branchHeight;
      const isSelected = branch.name === selectedBranch;
      const isMain = branch.name === gitData.mainBranch;
      const color = isSelected ? colors.selected : (isMain ? colors.main : colors.whatif);

      // Draw branch line
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(leftMargin + branch.commits.length * commitSpacing, y);
      ctx.stroke();

      // Draw branch label
      ctx.fillStyle = colors.label;
      ctx.font = isSelected ? 'bold 14px Inter' : '14px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(branch.name.replace('what-if/', 'what-if/\\n'), leftMargin - 10, y + 5);

      // Draw commits
      branch.commits.forEach((commit, commitIndex) => {
        const x = leftMargin + commitIndex * commitSpacing + commitSpacing / 2;
        const isHovered = commit.id === hoveredCommit;

        // Draw commit circle
        ctx.beginPath();
        ctx.arc(x, y, commitSize, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? colors.commitHover : colors.commit;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw commit message (on hover)
        if (isHovered) {
          ctx.fillStyle = colors.text;
          ctx.font = '12px Inter';
          ctx.textAlign = 'center';

          // Background for readability
          const textWidth = ctx.measureText(commit.message).width;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(x - textWidth/2 - 5, y + 20, textWidth + 10, 25);

          ctx.fillStyle = colors.text;
          ctx.fillText(commit.message, x, y + 35);
        }

        // Draw commit hash (abbreviated)
        ctx.fillStyle = colors.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(commit.id.substring(0, 7), x, y - 20);
      });

      // Draw merge lines for branches
      if (branch.parent && branchIndex > 0) {
        const parentIndex = gitData.branches.findIndex(b => b.name === branch.parent);
        if (parentIndex >= 0) {
          const parentY = topMargin + parentIndex * branchHeight;
          const divergeX = leftMargin + Math.min(branch.commits.length - 1, 2) * commitSpacing;

          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(divergeX, parentY);
          ctx.lineTo(divergeX, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !gitData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Configuration (same as in drawGitTree)
    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    // Check which commit was clicked
    gitData.branches.forEach((branch, branchIndex) => {
      const branchY = topMargin + branchIndex * branchHeight;

      // Check if click is on branch label area
      if (Math.abs(y - branchY) < 20 && x < leftMargin) {
        setSelectedBranch(branch.name);
        onBranchSelect?.(branch.name);
        return;
      }

      branch.commits.forEach((commit, commitIndex) => {
        const commitX = leftMargin + commitIndex * commitSpacing + commitSpacing / 2;
        const distance = Math.sqrt(Math.pow(x - commitX, 2) + Math.pow(y - branchY, 2));

        if (distance <= commitSize) {
          onCommitSelect?.(commit, branch.name);
        }
      });
    });
  };

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !gitData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Configuration (same as in drawGitTree)
    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    let foundHover = false;

    // Check which commit is being hovered
    gitData.branches.forEach((branch, branchIndex) => {
      const branchY = topMargin + branchIndex * branchHeight;

      branch.commits.forEach((commit, commitIndex) => {
        const commitX = leftMargin + commitIndex * commitSpacing + commitSpacing / 2;
        const distance = Math.sqrt(Math.pow(x - commitX, 2) + Math.pow(y - branchY, 2));

        if (distance <= commitSize) {
          setHoveredCommit(commit.id);
          canvas.style.cursor = 'pointer';
          foundHover = true;
        }
      });
    });

    if (!foundHover) {
      setHoveredCommit(null);
      canvas.style.cursor = 'default';
    }
  };

  // Unused for now - would be used for actual git operations
  // const checkoutBranch = async (branchName: string) => {
  //   try {
  //     const response = await fetch('/api/studio/git-checkout', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ branch: branchName })
  //     });

  //     if (response.ok) {
  //       setSelectedBranch(branchName);
  //       onBranchSelect?.(branchName);
  //     }
  //   } catch (error) {
  //     console.error('Failed to checkout branch:', error);
  //   }
  // };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Timeline Explorer</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Current Branch:</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm font-medium">
            {selectedBranch}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="relative overflow-x-auto">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasHover}
          onMouseLeave={() => setHoveredCommit(null)}
          className="border border-gray-200 rounded"
        />
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Main Timeline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">What-If Branch</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <span className="text-gray-600">Selected</span>
        </div>
      </div>
    </div>
  );
};