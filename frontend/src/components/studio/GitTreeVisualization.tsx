import React, { useEffect, useState, useRef } from 'react';
import type { GitVisualization, Commit } from '../../lib/studio/types';

interface GitTreeVisualizationProps {
  onBranchSelect?: (branch: string) => void;
  onCommitSelect?: (commit: Commit, branch: string) => void;
  currentBranch?: string;
}

/* Bauhaus palette for git visualization */
const BAUHAUS = {
  main: '#1040C0',
  whatif: '#D02020',
  selected: '#F0C020',
  commit: '#121212',
  commitHover: '#121212',
  line: '#121212',
  text: '#121212',
  label: '#121212',
};

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
    setSelectedBranch(currentBranch);
  }, [currentBranch]);

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
      const response = await fetch('/api/studio/projects/default/git-tree');
      if (response.ok) {
        const data = await response.json();
        setGitData(data);
        return;
      }
    } catch (error) {
      console.warn('Could not load git tree:', error);
    }
    setGitData({
      branches: [
        { name: 'main', commits: [] },
        { name: 'what-if/explore', parent: 'main', commits: [] }
      ],
      currentBranch: currentBranch,
      mainBranch: 'main'
    });
  };

  const drawGitTree = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !gitData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = Math.max(400, gitData.branches.length * 100);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    gitData.branches.forEach((branch, branchIndex) => {
      const y = topMargin + branchIndex * branchHeight;
      const isSelected = branch.name === selectedBranch;
      const isMain = branch.name === gitData.mainBranch;
      const color = isSelected ? BAUHAUS.selected : (isMain ? BAUHAUS.main : BAUHAUS.whatif);

      ctx.strokeStyle = BAUHAUS.line;
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(leftMargin + branch.commits.length * commitSpacing, y);
      ctx.stroke();

      ctx.fillStyle = BAUHAUS.label;
      ctx.font = isSelected ? 'bold 14px Outfit, sans-serif' : '14px Outfit, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(branch.name.replace('what-if/', 'what-if/\\n'), leftMargin - 10, y + 5);

      branch.commits.forEach((commit, commitIndex) => {
        const x = leftMargin + commitIndex * commitSpacing + commitSpacing / 2;
        const isHovered = commit.id === hoveredCommit;

        ctx.beginPath();
        ctx.arc(x, y, commitSize, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? color : BAUHAUS.commit;
        ctx.fill();
        ctx.strokeStyle = BAUHAUS.line;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isHovered) {
          ctx.fillStyle = BAUHAUS.text;
          ctx.font = '12px Outfit, sans-serif';
          ctx.textAlign = 'center';
          const textWidth = ctx.measureText(commit.message).width;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - textWidth / 2 - 6, y + 18, textWidth + 12, 28);
          ctx.strokeStyle = BAUHAUS.line;
          ctx.lineWidth = 2;
          ctx.strokeRect(x - textWidth / 2 - 6, y + 18, textWidth + 12, 28);
          ctx.fillStyle = BAUHAUS.text;
          ctx.fillText(commit.message, x, y + 35);
        }

        ctx.fillStyle = BAUHAUS.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(commit.id.substring(0, 7), x, y - 20);
      });

      if (branch.parent && branchIndex > 0) {
        const parentIndex = gitData.branches.findIndex(b => b.name === branch.parent);
        if (parentIndex >= 0) {
          const parentY = topMargin + parentIndex * branchHeight;
          const divergeX = leftMargin + Math.min(branch.commits.length - 1, 2) * commitSpacing;
          ctx.strokeStyle = BAUHAUS.line;
          ctx.lineWidth = 2;
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

    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    gitData.branches.forEach((branch, branchIndex) => {
      const branchY = topMargin + branchIndex * branchHeight;

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

    const branchHeight = 80;
    const commitSize = 12;
    const commitSpacing = 120;
    const leftMargin = 150;
    const topMargin = 50;

    let foundHover = false;

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

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-[#121212] uppercase tracking-widest">Current Branch:</span>
        <span className="px-3 py-1.5 bg-[#121212] text-[#F0C020] border-2 border-[#121212] font-bold uppercase text-sm">
          {selectedBranch}
        </span>
      </div>

      <div ref={containerRef} className="relative overflow-x-auto">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasHover}
          onMouseLeave={() => setHoveredCommit(null)}
          className="border-4 border-[#121212] bg-white shadow-bauhaus"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 text-sm font-bold uppercase tracking-widest text-[#121212]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-none bg-[#1040C0] border-2 border-[#121212]" />
          <span>Main Timeline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#D02020] border-2 border-[#121212]" />
          <span>What-If Branch</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#F0C020] border-2 border-[#121212]" style={{ transform: 'rotate(45deg)' }} />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
};
