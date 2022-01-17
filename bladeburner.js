export const contracts = [
	"Tracking", "Bounty Hunter", "Retirement"
].reverse()
export const operations = [
	"Investigation", "Undercover Operation", "Sting Operation",
	"Raid", "Stealth Retirement Operation", "Assassination"
].reverse()

/** @param {NS} ns **/
export async function main(ns) {
	let player = new Blade(ns)
	ns.disableLog("ALL")

	while (true) {
		await player.mainLoop()
	}
}


/**
 * Bladeburner class
 */
class Blade {
	/** @param {NS} ns */
	constructor(ns, loop = 1000) {
		this.ns = ns
		this.recover = false
		this.interval = loop
	}

	/**
	 * Main loop of bladeburner actions
	 */
	async mainLoop() {
		let action = this.#nextAction()
		this.doAction(action.action, action.category)
		this.levelUp()
		await this.ns.sleep(this.interval)
		return true
	}

	/** 
	 * @param {string} action
	 * @param {string} category
	 */
	doAction(action, category) {
		let curr = this.ns.bladeburner.getCurrentAction().name
		if (this.ns.bladeburner.getBlackOpNames().includes(curr)) return
		if (curr != action) {
			this.ns.bladeburner.startAction(category, action)
			this.ns.print(`INFO: Starting ${action}`)
		}
	}

	/**
	 * Determines next Bladeburner action to take
	 */
	#nextAction() {
		if (this.ns.bladeburner.getStamina()[0] < this.ns.bladeburner.getStamina()[1] / 2) this.recover = true
		else if (this.ns.bladeburner.getStamina()[0] == this.ns.bladeburner.getStamina()[1]) this.recover = false

		if (this.recover) return this.#recoverAction()
		else return this.#mainAction()
	}

	/**
	 * Determines the recovery action to take
	 */
	#recoverAction() {
		let recovery = { action: "err", category: "general" }
		if (this.#shouldIntel()) recovery.action = "Field Analysis"
		else if (this.ns.bladeburner.getCityChaos(this.ns.bladeburner.getCity()) > 10) recovery.action = "Diplomacy"
		else recovery.action = "Training"

		return recovery
	}

	/**
	 * Determines which main action to take
	 */
	#mainAction() {
		let bestAction = { category: undefined, action: undefined }

		bestAction.action = operations.find(
			x => this.ns.bladeburner.getActionEstimatedSuccessChance("operations", x)[0] >= 0.25
				&&
				this.ns.bladeburner.getActionCountRemaining("operations", x) > 0
		)
		if (bestAction.action === undefined) bestAction.action = contracts.find(
			x => this.ns.bladeburner.getActionEstimatedSuccessChance("contracts", x)[0] >= 0.25
		)
		if (bestAction.action === undefined) throw "could not find action above 25%"

		if (this.ns.bladeburner.getContractNames().includes(bestAction.action)) bestAction.category = "contracts"
		else bestAction.category = "operations"

		return bestAction
	}

	#shouldIntel() {
		let intel = operations.find(x => this.ns.bladeburner.getActionEstimatedSuccessChance("operations", x)[1]
			-
			this.ns.bladeburner.getActionEstimatedSuccessChance("operations", x)[0] >= 0.1)

		if (intel) return true
		else return false
	}

	levelUp(skill = this.#nextSkill()) {
		let success = this.ns.bladeburner.upgradeSkill(skill)
		if (success) this.ns.print(`SUCCESS: Upgraded ${skill}`)
		return success
	}

	#nextSkill() {
		if (this.ns.bladeburner.getSkillLevel("Overclock") < 90) return "Overclock"
		let permaSkills = [
			"Blade's Intuition",
			"Digital Observer",
			"Reaper",
			"Evasive System"
		]

		let lowest = "Blade's Intuition"
		for (let x of permaSkills) {
			if (this.ns.bladeburner.getSkillUpgradeCost(x) < this.ns.bladeburner.getSkillUpgradeCost(lowest)) lowest = x
		}

		return lowest
	}
}
