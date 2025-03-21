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
const Ticket = ({ ticket, index, columnId, moveTicket, handleAssign, handleDelete, handleEdit, isLoading, loadingAction }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
  });

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

  return (
    <div
      ref={ref}
      className={`ticket ${ticket.priority.toLowerCase()}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
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
          <div className="ticket-actions">
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading || loadingAction}
            >
              Edit
            </button>
            <button
              className="delete-button"
              onClick={() => handleDelete(ticket.id, columnId)}
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
const Column = ({ columnId, tickets, moveTicket, handleAssign, handleDelete, handleEdit, isLoading, loadingAction }) => {
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
      <h2>{columnId}</h2>
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
            isLoading={isLoading}
            loadingAction={loadingAction}
          />
        ))}
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [tickets, setTickets] = useState([]);
  const [columns, setColumns] = useState({});
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    assignee: '',
    sprint: 'Sprint 1',
  });
  const [isLoading, setIsLoading] = useState(true); // Initial loading state
  const [loadingAction, setLoadingAction] = useState(false); // Loading state for actions
  const [errorMessage, setErrorMessage] = useState(''); // Error message state

  // Fetch tickets from the backend
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const response = await axios.get('http://localhost:5000/tickets');
      const fetchedTickets = response.data;

      // Organize tickets into columns and sort by order
      const newColumns = {};
      columnsOrder.forEach((column) => {
        const columnTickets = fetchedTickets.filter(
          (ticket) => ticket.status === column
        );
        // Sort tickets by order
        newColumns[column] = columnTickets.sort((a, b) => a.order - b.order);
      });
      setColumns(newColumns);
      setTickets(fetchedTickets);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      setErrorMessage('Failed to load tickets. Please try again later.');
    } finally {
      setIsLoading(false);
    }
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
        await fetchTickets();
      }

      console.log('Move completed successfully');
    } catch (error) {
      console.error('Error in moveTicket:', error);
      setErrorMessage('Failed to move ticket. Please try again.');
      // Refresh the state from the backend to ensure consistency
      fetchTickets();
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

      // Update ticket in the column
      const updatedColumn = columns[columnId].map((t) =>
        t.id === ticketId ? updatedTicket : t
      );

      setColumns({
        ...columns,
        [columnId]: updatedColumn,
      });

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
      await fetchTickets(); // Refresh to ensure consistency
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      setErrorMessage('Failed to assign ticket. Please try again.');
      fetchTickets(); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle ticket deletion
  const handleDelete = async (ticketId, columnId) => {
    if (isLoading || loadingAction) return;

    try {
      setLoadingAction(true);
      setErrorMessage('');
      await axios.delete(`http://localhost:5000/tickets/${ticketId}`);

      // Refresh tickets
      await fetchTickets();
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      setErrorMessage('Failed to delete ticket. Please try again.');
      fetchTickets(); // Refresh the state to ensure consistency
    } finally {
      setLoadingAction(false);
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

      // Update ticket in the column
      const updatedColumn = columns[columnId].map((t) =>
        t.id === ticketId ? updatedTicket : t
      );

      setColumns({
        ...columns,
        [columnId]: updatedColumn,
      });

      // Update ticket in the backend
      await axios.put(`http://localhost:5000/tickets/${ticketId}`, updatedTicket);
      await fetchTickets(); // Refresh to ensure consistency
    } catch (error) {
      console.error('Failed to edit ticket:', error);
      setErrorMessage('Failed to edit ticket. Please try again.');
      fetchTickets(); // Refresh the state to ensure consistency
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
      await fetchTickets();

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

        {isLoading ? (
          <div className="loading">Loading tickets...</div>
        ) : (
          <>
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
                  <input
                    type="text"
                    value={newTicket.sprint}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, sprint: e.target.value })
                    }
                    disabled={isLoading || loadingAction}
                  />
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
                  isLoading={isLoading}
                  loadingAction={loadingAction}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </DndProvider>
  );
};

export default App;
