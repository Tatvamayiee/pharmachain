// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrescriptionRegistry
/// @notice Minimal on-chain registry for confirmed prescription hashes on
///         Polygon Amoy. Stores ONLY: prescriptionId => keccak256 hash of the
///         confirmed data, plus the registrant address and block timestamp.
///         Never stores prescription images, patient names, or clinical data.
contract PrescriptionRegistry {
    struct Record {
        bytes32 hash;
        address registeredBy;
        uint64 registeredAt;
    }

    mapping(string => Record) private records;
    address public owner;

    event Registered(string indexed prescriptionId, bytes32 hash, address indexed registeredBy, uint64 at);

    error NotOwner();
    error EmptyHash();
    error AlreadyRegistered(string prescriptionId, bytes32 existingHash);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Register the confirmed-data hash for a prescription id.
    ///         Re-registering the SAME id+hash is idempotent; a DIFFERENT
    ///         hash for an existing id reverts (immutability of the record).
    function register(string calldata prescriptionId, bytes32 hash) external {
        if (msg.sender != owner) revert NotOwner();
        if (hash == bytes32(0)) revert EmptyHash();
        Record storage existing = records[prescriptionId];
        if (existing.hash != bytes32(0)) {
            if (existing.hash != hash) revert AlreadyRegistered(prescriptionId, existing.hash);
            return; // idempotent re-confirm
        }
        records[prescriptionId] = Record(hash, msg.sender, uint64(block.timestamp));
        emit Registered(prescriptionId, hash, msg.sender, uint64(block.timestamp));
    }

    /// @notice The stored hash for a prescription id (0 when absent).
    function getHash(string calldata prescriptionId) external view returns (bytes32) {
        return records[prescriptionId].hash;
    }

    /// @notice Whether the given hash matches the on-chain record.
    function verify(string calldata prescriptionId, bytes32 hash) external view returns (bool) {
        return records[prescriptionId].hash == hash && hash != bytes32(0);
    }

    /// @notice Registration metadata for UI display (no clinical data).
    function getRecord(string calldata prescriptionId)
        external
        view
        returns (bytes32 hash, address registeredBy, uint64 registeredAt)
    {
        Record storage r = records[prescriptionId];
        return (r.hash, r.registeredBy, r.registeredAt);
    }
}
