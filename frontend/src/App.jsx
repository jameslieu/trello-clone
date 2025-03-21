import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import './App.css';

// Define the drag-and-drop item type
const ItemTypes = {
  TICKET: 'ticket',
};

// Define the columns order
const columnsOrder = [
  'ToDo',
  'In Progress',
  'Ready for Review',
  'Ready for QA',
  'Ready for Release',
  'Done',
];

// Weighting for prioritization
const priorityWeights = {
  High: 3,
  Medium: 2,
  Low: 1,
};

// Ticket component (draggable)
const Ticket = ({ ticket, index, columnId, moveTicket, handleAssign, handleDelete, handleEdit, handleAddComment, isLoading, loadingAction, isSelected, onSelect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
  });
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const ref = useRef(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TICKET,
    item: { id: ticket.id, index, columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !isLoading && !loadingAction && !isEditing, // Prevent dragging while loading or editing
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemTypes.TICKET,
    hover: (item, monitor) => {
      if (!ref.current || isLoading || loadingAction || isEditing) return;

      const dragIndex = item.index;
      const hoverIndex = index;
      const dragColumnId = item.columnId;
      const hoverColumnId = columnId;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex && dragColumnId === hoverColumnId) return;

      // Only reorder within the same column
      if (dragColumnId === hoverColumnId) {
        moveTicket(item.id, dragColumnId, hoverColumnId, dragIndex, hoverIndex);
        item.index = hoverIndex; // Update the index for the dragged item
      }
    },
  }));

  drag(drop(ref));

  const handleEditSubmit = (e) => {
    e.preventDefault();
    handleEdit(ticket.id, columnId, editForm);
    setIsEditing(false);
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    handleAddComment(ticket.id, columnId, newComment);
    setNewComment('');
  };

  return (
    <div
      ref={ref}
      className={`ticket ${ticket.priority.toLowerCase()} ${isSelected ? 'selected' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="ticket-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(ticket.id)}
          disabled={isLoading || loadingAction || isEditing}
        />
      </div>
      {isEditing ? (
        <form onSubmit={handleEditSubmit} className="edit-form">
          <div>
            <label>Title:</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Description:</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Priority:</label>
            <select
              value={editForm.priority}
              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <button type="submit" disabled={loadingAction}>
            {loadingAction ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} disabled={loadingAction}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <h3>{ticket.title}</h3>
          <p>{ticket.description}</p>
          <p>Priority: {ticket.priority} (Weight: {priorityWeights[ticket.priority]})</p>
          <p>Assignee: {ticket.assignee || 'Unassigned'}</p>
          <p>Sprint: {ticket.sprint}</p>
          <p>Created: {new Date(ticket.createdAt).toLocaleDateString()}</p>
          {columnId === 'Ready for Review' && !ticket.assignee && (
            <select
              onChange={(e) => handleAssign(ticket.id, columnId, e.target.value)}
              defaultValue=""
              disabled={isLoading || loadingAction}
            >
              <option value="" disabled>
                Assign to...
              </option>
              <option value="Alice">Alice</option>
              <option value="Bob">Bob</option>
              <option value="Charlie">Charlie</option>
              <option value="Diana">Diana</option>
            </select>
          )}
          {/* Comments Section */}
          <div className="ticket-section">
            <button onClick={() => setShowComments(!showComments)} className="toggle-button">
              {showComments ? 'Hide Comments' : `Show Comments (${ticket.comments.length})`}
            </button>
            {showComments && (
              <div className="comments-section">
                {ticket.comments.length > 0 ? (
                  <ul>
                    {ticket.comments.map((comment, index) => (
                      <li key={index}>
                        <p>{comment.text}</p>
                        <small>{new Date(comment.timestamp).toLocaleString()}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No comments yet.</p>
                )}
                <form onSubmit={handleCommentSubmit} className="comment-form">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    disabled={isLoading || loadingAction}
                  />
                  <button type="submit" disabled={isLoading || loadingAction || !newComment.trim()}>
                    Add Comment
                  </button>
                </form>
              </div>
            )}
          </div>
          {/* History Section */}
          <div className="ticket-section">
            <button onClick={() => setShowHistory(!showHistory)} className="toggle-button">
              {showHistory ? 'Hide History' : `Show History (${ticket.history.length})`}
            </button>
            {showHistory && (
              <div className="history-section">
                {ticket.history.length > 0 ? (
                  <ul>
                    {ticket.history.map((entry, index) => (
                      <li key={index}>
                        <p>{entry.action}</p>
                        <small>{new Date(entry.timestamp).toLocaleString()}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No history available.</p>
                )}
              </div>
            )}
          </div>
          <div className="ticket-actions">
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading || loadingAction}
            >
              Edit
            </button>
            <button
              className="delete-button"
              onClick={() => handleDelete(ticket.id, columnId, ticket.title)}
              disabled={isLoading || loadingAction}
            >
              {loadingAction ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Column component (droppable)
const Column = ({ columnId, tickets, moveTicket, handleAssign, handleDelete, handleEdit, handleAddComment, isLoading, loadingAction, sortBy, onSortChange, selectedTickets, onSelectTicket }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.TICKET,
    drop: (item, monitor) => {
      if (isLoading || loadingAction) return;
      if (item.columnId !== columnId) {
        // Move ticket to a new column
        moveTicket(item.id, item.columnId, columnId, item.index, null);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div ref={drop} className="column" style={{ backgroundColor: isOver ? '#e0e0e0' : '#f4f5f7' }}>
      <div className="column-header">
        <h2>{columnId}</h2>
        <select value={sortBy} onChange={(e) => onSortChange(columnId, e.target.value)} disabled={isLoading || loadingAction}>
          <option value="order">Default (Drag Order)</option>
          <option value="priority-desc">Priority (High to Low)</option>
          <option value="priority-asc">Priority (Low to High)</option>
          <option value="created-desc">Created (Newest to Oldest)</option>
          <option value="created-asc">Created (Oldest to Newest)</option>
        </select>
      </div>
      <div className="ticket-list">
        {tickets.map((ticket, index) => (
          <Ticket
            key={ticket.id}
            ticket={ticket}
            index={index}
            columnId={columnId}
            moveTicket={moveTicket}
            handleAssign={handleAssign}
            handleDelete={handleDelete}
            handleEdit={handleEdit}
            handleAddComment={handleAddComment}
            isLoading={isLoading}
            loadingAction={loadingAction}
            isSelected={selectedTickets.includes(ticket.id)}
            onSelect={onSelectTicket}
          />
        ))}
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [columns, setColumns] = useState({});
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    assignee: '',
    sprint: 'Sprint 1',
  });
  const [isLoading, setIsLoading] = useState(false); // Initial loading state
  const [loadingAction, setLoadingAction] = useState(false); // Loading state for actions
  const [errorMessage, setErrorMessage] = useState(''); // Error message state
  const [filters, setFilters] = useState({
    priority: '',
    assignee: '',
    sprint: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // State for delete confirmation
  const [sortByColumn, setSortByColumn] = useState({}); // State for sorting per column
  const [selectedTickets, setSelectedTickets] = useState([]); // State for selected tickets
  const [page, setPage] = useState(1); // Pagination page
  const [totalPages, setTotalPages] = useState(1); // Total pages
  const [totalTickets, setTotalTickets] = useState(0); // Total tickets
  const limit = 10; // Tickets per page

  // Fetch tickets from the backend with pagination
  const fetchTickets = async (pageToFetch = page, append = false) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const response = await axios.get(`http://localhost:5000/tickets?page=${pageToFetch}&limit=${limit}`);
      const { tickets: fetchedTickets, total, page: currentPage, totalPages: pages } = response.data;

      setTickets((prev) => (append ? [...prev, ...fetchedTickets] : fetchedTickets));
      setTotalTickets(total);
      setTotalPages(pages);
      setPage(currentPage);
      applyFiltersAndSearch(append ? [...tickets, ...fetchedTickets] : fetchedTickets, filters, searchQuery);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      setErrorMessage('Failed to load tickets. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Load more tickets
  const loadMoreTickets = () => {
    if (page < totalPages) {
      fetchTickets(page + 1, true);
    }
  };

  // Apply filters, search, and sorting to tickets
  const applyFiltersAndSearch = (ticketsToFilter, currentFilters, currentSearchQuery) => {
    let filtered = [...ticketsToFilter];

    // Apply filters
    if (currentFilters.priority) {
      filtered = filtered.filter((ticket) => ticket.priority === currentFilters.priority);
    }
    if (currentFilters.assignee) {
      filtered = filtered.filter((ticket) => ticket.assignee === currentFilters.assignee);
    }
    if (currentFilters.sprint) {
      filtered = filtered.filter((ticket) => ticket.sprint === currentFilters.sprint);
    }

    // Apply search
    if (currentSearchQuery) {
      const query = currentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(query) ||
          ticket.description.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);

    // Organize filtered tickets into columns and apply sorting
    const newColumns = {};
    columnsOrder.forEach((column) => {
      let columnTickets = filtered.filter((ticket) => ticket.status === column);
      const sortBy = sortByColumn[column] || 'order';

      // Apply sorting
      if (sortBy === 'priority-desc') {
        columnTickets = columnTickets.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);
      } else if (sortBy === 'priority-asc') {
        columnTickets = columnTickets.sort((a, b) => priorityWeights[a.priority] - priorityWeights[b.priority]);
      } else if (sortBy === 'created-desc') {
        columnTickets = columnTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sortBy === 'created-asc') {
        columnTickets = columnTickets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else {
        columnTickets = columnTickets.sort((a, b) => a.order - b.order);
      }

      newColumns[column] = columnTickets;
    });
    setColumns(newColumns);
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const updatedFilters = { ...filters, [name]: value };
    setFilters(updatedFilters);
    applyFiltersAndSearch(tickets, updatedFilters, searchQuery);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    applyFiltersAndSearch(tickets, filters, query);
  };

  // Handle sort change for a column
  const handleSortChange = (columnId, sortBy) => {
    const updatedSortByColumn = { ...sortByColumn, [columnId]: sortBy };
    setSortByColumn(updatedSortByColumn);
    applyFiltersAndSearch(tickets, filters, searchQuery);
  };

  // Handle ticket selection
  const handleSelectTicket = (ticketId) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  // Bulk action: Move selected tickets to a new column
  const handleBulkMove = async (destColumnId) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');

      const updatedTickets = tickets.map((ticket) => {
        if (selectedTickets.includes(ticket.id)) {
          return { ...ticket, status: destColumnId, order: 0 };
        }
        return ticket;
      });

      // Update all affected tickets in the backend
      for (const ticket of updatedTickets) {
        if (selectedTickets.includes(ticket.id)) {
          await axios.put(`http://localhost:5000/tickets/${ticket.id}`, ticket);
          await delay(50);
        }
      }

      // Fetch the latest data from the backend
      await fetchTickets(1);
      setSelectedTickets([]);
    } catch (error) {
      console.error('Failed to move tickets:', error);
      setErrorMessage('Failed to move tickets. Please try again.');
      fetchTickets(1);
    } finally {
      setLoadingAction(false);
    }
  };

  // Bulk action: Assign selected tickets to a user
  const handleBulkAssign = async (assignee) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');

      const updatedTickets = tickets.map((ticket) => {
        if (selectedTickets.includes(ticket.id)) {
          return { ...ticket, assignee };
        }
        return ticket;
      });

      // Update all affected tickets in the backend
      for (const ticket of updatedTickets) {
        if (selectedTickets.includes(ticket.id)) {
          await axios.put(`http://localhost:5000/tickets/${ticket.id}`, ticket);
          await delay(50);
        }
      }

      // Fetch the latest data from the backend
      await fetchTickets(1);
      setSelectedTickets([]);
    } catch (error) {
      console.error('Failed to assign tickets:', error);
      setErrorMessage('Failed to assign tickets. Please try again.');
      fetchTickets(1);
    } finally {
      setLoadingAction(false);
    }
  };

  // Bulk action: Delete selected tickets
  const handleBulkDelete = () => {
    setShowDeleteConfirm({ bulk: true, ticketIds: selectedTickets });
  };

  // Helper function to add a delay between requests
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Handle ticket movement between columns or within the same column
  const moveTicket = async (ticketId, sourceColumnId, destColumnId, dragIndex, hoverIndex) => {
    if (isLoading || loadingAction) {
      console.log('Move aborted: App is still loading or another action is in progress');
      return;
    }

    try {
      setLoadingAction(true);
      setErrorMessage('');
      console.log(`Moving ticket ${ticketId} from ${sourceColumnId} (index ${dragIndex}) to ${destColumnId}${hoverIndex !== null ? ` (index ${hoverIndex})` : ''}`);

      // Create a deep copy of the columns to avoid mutating state directly
      const newColumns = { ...columns };

      // Check if sourceColumnId exists in newColumns
      if (!newColumns[sourceColumnId] || !Array.isArray(newColumns[sourceColumnId])) {
        console.error(`Source column ${sourceColumnId} is not iterable:`, newColumns[sourceColumnId]);
        return;
      }

      const sourceColumn = [...newColumns[sourceColumnId]];
      const ticketIndex = sourceColumn.findIndex((t) => t.id === ticketId);

      if (ticketIndex === -1) {
        console.error(`Ticket with ID ${ticketId} not found in column ${sourceColumnId}`);
        return;
      }

      const [movedTicket] = sourceColumn.splice(ticketIndex, 1);

      // Update ticket status and assignee logic
      let updatedTicket = { ...movedTicket };
      if (sourceColumnId !== destColumnId) {
        updatedTicket = { ...updatedTicket, status: destColumnId };
        // Unassign when moving to "Ready for Review"
        if (destColumnId === 'Ready for Review') {
          updatedTicket = { ...updatedTicket, assignee: '' };
        }
      }

      // If moving within the same column (reordering)
      if (sourceColumnId === destColumnId) {
        const destColumn = [...sourceColumn];
        destColumn.splice(hoverIndex, 0, updatedTicket);

        // Update the order field for all tickets in the column
        const updatedDestColumn = destColumn.map((ticket, index) => ({
          ...ticket,
          order: index,
        }));

        // Update columns state
        newColumns[sourceColumnId] = updatedDestColumn;
        setColumns(newColumns);

        // Update all tickets in the backend with a slight delay between requests
        for (const ticket of updatedDestColumn) {
          console.log(`Updating ticket ${ticket.id} with order ${ticket.order} in column ${sourceColumnId}`);
          await axios.put(`http://localhost:5000/tickets/${ticket.id}`, ticket);
          await delay(50); // Add a 50ms delay to avoid overwhelming the backend
        }
      } else {
        // Check if destColumnId exists in newColumns
        if (!newColumns[destColumnId] || !Array.isArray(newColumns[destColumnId])) {
          console.error(`Destination column ${destColumnId} is not iterable:`, newColumns[destColumnId]);
          return;
        }

        // Moving to a different column
        const destColumn = [...newColumns[destColumnId]];
        destColumn.push(updatedTicket);

        // Update the order field for all tickets in the destination column
        const updatedDestColumn = destColumn.map((ticket, index) => ({
          ...ticket,
          order: index,
        }));

        // Update the order field for all tickets in the source column
        const updatedSourceColumn = sourceColumn.map((ticket, index) => ({
          ...ticket,
          order: index,
        }));

        // Update columns state
        newColumns[sourceColumnId] = updatedSourceColumn;
        newColumns[destColumnId] = updatedDestColumn;

        // Log the state before updating
        console.log('Before state update:');
        console.log(`Source column (${sourceColumnId}):`, updatedSourceColumn);
        console.log(`Destination column (${destColumnId}):`, updatedDestColumn);

        setColumns(newColumns);

        // Update all tickets in the backend (for both source and destination columns)
        const allTickets = [...updatedSourceColumn, ...updatedDestColumn];
        for (const ticket of allTickets) {
          console.log(`Updating ticket ${ticket.id} with status ${ticket.status} and order ${ticket.order}`);
          await axios.put(`http://localhost:5000/tickets/${ticket.id}`, ticket);
          await delay(50); // Add a 50ms delay to avoid overwhelming the backend
        }

        // Fetch the latest data from the backend to ensure consistency
        await fetchTickets(1);
      }

      console.log('Move completed successfully');
    } catch (error) {
      console.error('Error in moveTicket:', error);
      setErrorMessage('Failed to move ticket. Please try again.');
      // Refresh the state from the backend to ensure consistency
      fetchTickets(1);
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle assignee change
  const handleAssign = async (ticketId, columnId, newAssignee) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');
      const ticket = columns[columnId].find((t) => t.id === ticketId);
      const updatedTicket = { ...ticket, assignee: newAssignee };

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
      await fetchTickets(1); // Refresh to ensure consistency
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      setErrorMessage('Failed to assign ticket. Please try again.');
      fetchTickets(1); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle ticket deletion with confirmation
  const handleDelete = (ticketId, columnId, ticketTitle) => {
    setShowDeleteConfirm({ ticketId, columnId, ticketTitle });
  };

  const confirmDelete = async () => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');

      if (showDeleteConfirm.bulk) {
        // Bulk delete
        for (const ticketId of showDeleteConfirm.ticketIds) {
          await axios.delete(`http://localhost:5000/tickets/${ticketId}`);
          await delay(50);
        }
        setSelectedTickets([]);
      } else {
        // Single delete
        const { ticketId } = showDeleteConfirm;
        await axios.delete(`http://localhost:5000/tickets/${ticketId}`);
      }

      // Refresh tickets
      await fetchTickets(1);
    } catch (error) {
      console.error('Failed to delete ticket(s):', error);
      setErrorMessage('Failed to delete ticket(s). Please try again.');
      fetchTickets(1); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
      setShowDeleteConfirm(null);
    }
  };

  // Handle ticket editing
  const handleEdit = async (ticketId, columnId, updatedData) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');
      const ticket = columns[columnId].find((t) => t.id === ticketId);
      const updatedTicket = { ...ticket, ...updatedData };

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
      await fetchTickets(1); // Refresh to ensure consistency
    } catch (error) {
      console.error('Failed to edit ticket:', error);
      setErrorMessage('Failed to edit ticket. Please try again.');
      fetchTickets(1); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle adding a comment to a ticket
  const handleAddComment = async (ticketId, columnId, commentText) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');
      const ticket = columns[columnId].find((t) => t.id === ticketId);
      const newComment = {
        text: commentText,
        timestamp: new Date().toISOString(),
      };
      const updatedComments = [...(ticket.comments || []), newComment];
      const updatedTicket = { ...ticket, comments: updatedComments };

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
      await fetchTickets(1); // Refresh to ensure consistency
    } catch (error) {
      console.error('Failed to add comment:', error);
      setErrorMessage('Failed to add comment. Please try again.');
      fetchTickets(1); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle new ticket form submission
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');
      const response = await axios.post('http://localhost:5000/tickets', newTicket);
      const createdTicket = response.data;

      // Refresh tickets
      await fetchTickets(1);

      // Reset form
      setNewTicket({
        title: '',
        description: '',
        priority: 'Medium',
        assignee: '',
        sprint: 'Sprint 1',
      });
    } catch (error) {
      console.error('Failed to create ticket:', error);
      setErrorMessage('Failed to create ticket. Please try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <h1>Trello Clone</h1>

        {errorMessage && (
          <div className="error-message">
            {errorMessage}
            <button onClick={() => setErrorMessage('')}>Dismiss</button>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="delete-confirm">
            <div className="delete-confirm-content">
              <h3>Confirm Deletion</h3>
              <p>
                {showDeleteConfirm.bulk
                  ? `Are you sure you want to delete ${showDeleteConfirm.ticketIds.length} selected tickets?`
                  : `Are you sure you want to delete the ticket "${showDeleteConfirm.ticketTitle}"?`}
              </p>
              <div className="delete-confirm-buttons">
                <button onClick={confirmDelete} disabled={loadingAction}>
                  {loadingAction ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(null)} disabled={loadingAction}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && tickets.length === 0 ? (
          <div className="loading">Loading tickets...</div>
        ) : (
          <>
            {/* Bulk Actions Section */}
            {selectedTickets.length > 0 && (
              <div className="bulk-actions">
                <span>{selectedTickets.length} ticket(s) selected</span>
                <div className="bulk-action-controls">
                  <select
                    onChange={(e) => handleBulkMove(e.target.value)}
                    defaultValue=""
                    disabled={isLoading || loadingAction}
                  >
                    <option value="" disabled>
                      Move to...
                    </option>
                    {columnsOrder.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                  <select
                    onChange={(e) => handleBulkAssign(e.target.value)}
                    defaultValue=""
                    disabled={isLoading || loadingAction}
                  >
                    <option value="" disabled>
                      Assign to...
                    </option>
                    <option value="Alice">Alice</option>
                    <option value="Bob">Bob</option>
                    <option value="Charlie">Charlie</option>
                    <option value="Diana">Diana</option>
                    <option value="">Unassigned</option>
                  </select>
                  <button
                    className="bulk-delete-button"
                    onClick={handleBulkDelete}
                    disabled={isLoading || loadingAction}
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedTickets([])}
                    disabled={isLoading || loadingAction}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Filter and Search Section */}
            <div className="filter-search">
              <div className="filters">
                <div>
                  <label>Filter by Priority:</label>
                  <select
                    name="priority"
                    value={filters.priority}
                    onChange={handleFilterChange}
                    disabled={isLoading || loadingAction}
                  >
                    <option value="">All</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label>Filter by Assignee:</label>
                  <select
                    name="assignee"
                    value={filters.assignee}
                    onChange={handleFilterChange}
                    disabled={isLoading || loadingAction}
                  >
                    <option value="">All</option>
                    <option value="Alice">Alice</option>
                    <option value="Bob">Bob</option>
                    <option value="Charlie">Charlie</option>
                    <option value="Diana">Diana</option>
                    <option value="">Unassigned</option>
                  </select>
                </div>
                <div>
                  <label>Filter by Sprint:</label>
                  <select
                    name="sprint"
                    value={filters.sprint}
                    onChange={handleFilterChange}
                    disabled={isLoading || loadingAction}
                  >
                    <option value="">All</option>
                    <option value="Sprint 1">Sprint 1</option>
                    <option value="Sprint 2">Sprint 2</option>
                    <option value="Sprint 3">Sprint 3</option>
                  </select>
                </div>
              </div>
              <div className="search">
                <label>Search:</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search by title or description..."
                  disabled={isLoading || loadingAction}
                />
              </div>
            </div>

            {/* Form to create a new ticket */}
            <div className="create-ticket">
              <h2>Create New Ticket</h2>
              <form onSubmit={handleCreateTicket}>
                <div>
                  <label>Title:</label>
                  <input
                    type="text"
                    value={newTicket.title}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, title: e.target.value })
                    }
                    required
                    disabled={isLoading || loadingAction}
                  />
                </div>
                <div>
                  <label>Description:</label>
                  <textarea
                    value={newTicket.description}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, description: e.target.value })
                    }
                    required
                    disabled={isLoading || loadingAction}
                  />
                </div>
                <div>
                  <label>Priority:</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, priority: e.target.value })
                    }
                    disabled={isLoading || loadingAction}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label>Assignee:</label>
                  <select
                    value={newTicket.assignee}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, assignee: e.target.value })
                    }
                    disabled={isLoading || loadingAction}
                  >
                    <option value="">Unassigned</option>
                    <option value="Alice">Alice</option>
                    <option value="Bob">Bob</option>
                    <option value="Charlie">Charlie</option>
                    <option value="Diana">Diana</option>
                  </select>
                </div>
                <div>
                  <label>Sprint:</label>
                  <select
                    value={newTicket.sprint}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, sprint: e.target.value })
                    }
                    disabled={isLoading || loadingAction}
                  >
                    <option value="Sprint 1">Sprint 1</option>
                    <option value="Sprint 2">Sprint 2</option>
                    <option value="Sprint 3">Sprint 3</option>
                  </select>
                </div>
                <button type="submit" disabled={isLoading || loadingAction}>
                  {loadingAction ? 'Creating...' : 'Create Ticket'}
                </button>
              </form>
            </div>

            {/* Kanban Board */}
            <div className="board">
              {columnsOrder.map((columnId) => (
                <Column
                  key={columnId}
                  columnId={columnId}
                  tickets={columns[columnId] || []}
                  moveTicket={moveTicket}
                  handleAssign={handleAssign}
                  handleDelete={handleDelete}
                  handleEdit={handleEdit}
                  handleAddComment={handleAddComment}
                  isLoading={isLoading}
                  loadingAction={loadingAction}
                  sortBy={sortByColumn[columnId] || 'order'}
                  onSortChange={handleSortChange}
                  selectedTickets={selectedTickets}
                  onSelectTicket={handleSelectTicket}
                />
              ))}
            </div>

            {/* Load More Button */}
            {tickets.length < totalTickets && (
              <div className="load-more">
                <button onClick={loadMoreTickets} disabled={isLoading || loadingAction}>
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
                <p>
                  Showing {tickets.length} of {totalTickets} tickets
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DndProvider>
  );
};

export default App;
