/** @param {NS} ns **/
export function calculateGrowthThreads(ns, server, startMoney, maxMoney = ns.getServerMaxMoney(server), maxIterations = 100) {
	// maxIterations prevents it from somehow looping indefinitely
	var guess = 1;  // We can start with any number, really, but may as well make it simple.
	var previous = 0;
	var previous2 = 0;  // The time before the time before; should identify cyclicle outputs.
	startMoney = Math.max(0, startMoney);    // Can't start with <0 cash.
	if (startMoney >= maxMoney) {
		return 0;   // Good news! You're already there.
	}
	for (var iteration = 0; guess != previous && iteration < maxIterations; ++iteration) {
		previous = guess;
		let ratio = maxMoney / (startMoney + guess);
		if (ratio > 1) {
			guess = Math.ceil(ns.growthAnalyze(server, ratio));
		} else {
			guess = 1;  // We'd only need 1 thread to meet the goal if adding the guess is sufficient to reach maxMoney.
		}
		if (guess == previous2) {   // We got the same output we got the time before last.
			return Math.max(guess, previous);    // The smaller number of the two is obviously insufficient.
		}
		previous2 = previous;
	}
	if (iteration >= maxIterations) {
		// Whatever the biggest of the last three values was should be a safe guess.
		return Math.max(guess, previous, previous2);
	}
	return guess;   // It successfully stabilized!
}

/** @param {NS} ns **/
export async function main(ns) {

	function calcRatio(tgt, plyr, percent = 0.1) {
		let ratio = { hackthreads: 0, growthreads: 0, weakenHack: 0, weakenGrow: 0 }
		ratio.hackthreads = Math.floor(ns.hackAnalyzeThreads(tgt.hostname, ns.getServerMaxMoney(tgt.hostname) * percent))
		ratio.weakenHack = Math.ceil(ns.hackAnalyzeSecurity(ratio.hackthreads) / 0.05) + 5
		ratio.growthreads = calculateGrowthThreads(ns, tgt.hostname, tgt.moneyMax * (1 - percent))
		ratio.weakenGrow = Math.ceil(ns.growthAnalyzeSecurity(ratio.growthreads) / 0.05) + 5
		return ratio
	}


	function testPerfect(target) {
		if (ns.getServerMaxMoney(target) == ns.getServerMoneyAvailable(target)) {
			if (ns.getServerSecurityLevel(target) == ns.getServerMinSecurityLevel(target)) {
				return true
			}
			else {

			}
		}
		ns.print("Current security: " + ns.getServerSecurityLevel(target))
		ns.print("Goal security: " + ns.getServerMinSecurityLevel(target))
		ns.print("Current money: " + ns.getServerMoneyAvailable(target))
		ns.print("Goal money: " + ns.getServerMaxMoney(target))
		return false
	}

	function findGreatestRam(target, player, farm) {
		let prevRatio
		let greatRatio = 0.01
		let found = false
		while (!found) {
			let ratio = calcRatio(target, player, greatRatio)
			let total = (ratio.weakenGrow + ratio.weakenHack + ratio.hackthreads + ratio.growthreads) * 1.75
			if (total > (ns.getServerMaxRam(farm) - ns.getServerUsedRam(farm)) || greatRatio >= 1.01) {
				if (prevRatio >= 1.01) {
					throw "bad ratio return"
				}
				//ns.print("Before to float")
				//ns.print(prevRatio)
				ns.print("to float")
				ns.print(parseFloat(prevRatio.toFixed(2)))
				return parseFloat(prevRatio.toFixed(2))
			}
			else {
				prevRatio = greatRatio
				greatRatio += 0.01
				//ns.print(greatRatio.toFixed(2))
			}
			if (greatRatio > 5) {
				throw "oopsie woopsies in great ram finder :("
			}
		}
	}

	async function prepCycle(tgt, frm) {
		let maxThreads = (ns.getServerMaxRam(farm) - ns.getServerUsedRam(farm)) / 1.75 - 1
		while (ns.getServerSecurityLevel(tgt) > ns.getServerMinSecurityLevel(tgt)) {
			ns.exec("slaveWeaken1.ns", frm, maxThreads, tgt)
			await ns.sleep(ns.getWeakenTime(tgt) + 10)
		}

		while (ns.getServerMaxMoney(tgt) > ns.getServerMoneyAvailable(tgt)) {
			let weakThread = Math.ceil(ns.growthAnalyzeSecurity(maxThreads) / 0.05)
			let groThread = maxThreads - weakThread - 1
			ns.exec("slaveWeaken1.ns", frm, weakThread, tgt)
			ns.exec("slaveGrow.ns", frm, groThread, tgt)
			await ns.sleep(ns.getWeakenTime(tgt) + 10)
		}
	}

	async function test(str, time) {
		await ns.sleep(time)
		ns.tprint(str)
	}

	ns.disableLog("ALL")
	ns.enableLog("exec")
	ns.enableLog("sleep")

	const target = ns.getServer(ns.args[1])
	const farm = ns.args[0]
	const player = ns.getPlayer()

	await prepCycle(target.hostname, farm)
	ns.print(target.hostname + " successfully prepped for farming")
	ns.toast(target.hostname + " successfully prepped for farming")

	let ratioPercent = findGreatestRam(target, player, farm)

	while (true) {
		let level = player.hacking
		let ratio = calcRatio(target, player, ratioPercent)
		ns.print(ratio)
		ns.exec("slaveWeaken1.ns", farm, ratio.weakenHack, target.hostname)
		//ns.exec("test.ns", farm, ratio.weakenHack, ns.getWeakenTime(target.hostname), "Weaken1")
		await ns.sleep(60)
		ns.exec("slaveWeaken2.ns", farm, ratio.weakenGrow, target.hostname)
		//ns.exec("test.ns", farm, ratio.weakenGrow, ns.getWeakenTime(target.hostname), "Weaken2")
		let growNap = ns.getWeakenTime(target.hostname) - ns.getGrowTime(target.hostname) - 30
		await ns.sleep(growNap)
		ns.exec("slaveGrow.ns", farm, ratio.growthreads, target.hostname)
		//ns.exec("test.ns", farm, ratio.growthreads, ns.getGrowTime(target.hostname), "grow")
		await ns.sleep(ns.getGrowTime(target.hostname) - ns.getHackTime(target.hostname) - 60)
		ns.exec("slaveHack.ns", farm, ratio.hackthreads, target.hostname)
		//ns.exec("test.ns", farm, ratio.hackthreads, ns.getHackTime(target.hostname), "hack")
		await ns.sleep(ns.getHackTime(target.hostname) + 200)

		if (!testPerfect(target.hostname)) {
			ns.print("Target is IMPERFECT, perhaps due to a level up. Attempting correction")
			if (level == ns.getPlayer().hacking) {
				ns.print("Player did NOT level up, algorithm machine broke.")
			}
			await prepCycle(target.hostname, farm)
			ratioPercent = findGreatestRam(target, player, farm)
		}
		else {
			ns.print("Target is perfect, repeating")
		}
	}
}
