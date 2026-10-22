/**
 * PolicyGuard source code for the "View code" preview in the deployment UI.
 * Keep in sync with contracts/src/PolicyGuard.sol when that file changes.
 */
export const POLICY_GUARD_SOURCE = `// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.24;

import {Enum} from "./Enum.sol";
import {ITransactionGuard} from "./interfaces/ITransactionGuard.sol";
import {IPolicyModule} from "./interfaces/IPolicyModule.sol";
import {IERC165} from "./interfaces/IERC165.sol";

/**
 * @title PolicyGuard
 * @notice Composable Safe Guard: runs a list of policy modules in checkTransaction. Reverts if any module reverts.
 * @dev Owner (Safe or EOA) can add/remove modules. Set this contract as the Safe's Guard via setGuard().
 *      Modules must be contracts (have code) and duplicates are rejected. Module count is capped at MAX_MODULES.
 */
contract PolicyGuard is ITransactionGuard {
    /// @notice Maximum number of policy modules (gas griefing / DoS mitigation).
    uint256 public constant MAX_MODULES = 32;

    address public owner;
    address[] public modules;
    mapping(address => bool) public isModule;

    event ModuleAdded(address indexed module);
    event ModuleRemoved(address indexed module);
    event ModulesSet(address[] modules);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error InvalidModule();
    error DuplicateModule();
    error TooManyModules();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "PolicyGuard: zero owner");
        owner = _owner;
    }

    function setModules(address[] calldata _modules) external onlyOwner {
        for (uint256 i = 0; i < modules.length; i++) {
            isModule[modules[i]] = false;
        }
        delete modules;
        for (uint256 i = 0; i < _modules.length; i++) {
            address m = _modules[i];
            if (m == address(0)) continue;
            if (isModule[m]) revert DuplicateModule();
            if (m.code.length == 0) revert InvalidModule();
            if (modules.length >= MAX_MODULES) revert TooManyModules();
            modules.push(m);
            isModule[m] = true;
        }
        emit ModulesSet(_modules);
    }

    function addModule(address _module) external onlyOwner {
        if (_module == address(0)) revert InvalidModule();
        if (isModule[_module]) revert DuplicateModule();
        if (_module.code.length == 0) revert InvalidModule();
        if (modules.length >= MAX_MODULES) revert TooManyModules();
        modules.push(_module);
        isModule[_module] = true;
        emit ModuleAdded(_module);
    }

    function removeModule(address _module) external onlyOwner {
        uint256 len = modules.length;
        for (uint256 i = 0; i < len; i++) {
            if (modules[i] == _module) {
                modules[i] = modules[len - 1];
                modules.pop();
                isModule[_module] = false;
                emit ModuleRemoved(_module);
                return;
            }
        }
        revert InvalidModule();
    }

    function setOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PolicyGuard: zero owner");
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnerChanged(oldOwner, _newOwner);
    }

    function getModules() external view returns (address[] memory) {
        return modules;
    }

    /**
     * @inheritdoc ITransactionGuard
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external view override {
        for (uint256 i = 0; i < modules.length; i++) {
            IPolicyModule(modules[i]).checkTransaction(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                signatures,
                msgSender
            );
        }
    }

    /**
     * @inheritdoc ITransactionGuard
     */
    function checkAfterExecution(bytes32 /* hash */, bool /* success */) external view override {
        // No post-execution policy checks in v1
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(ITransactionGuard).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
`;
