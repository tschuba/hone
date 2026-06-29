## ADDED Requirements

### Requirement: Domain Behavior Boundaries
The system SHALL enforce allowed and prohibited output classes for each domain agent, and SHALL treat these agents as contextualizing the user's stated requirements rather than as real clinical/medical/dietetic authorities — even technically-allowed content SHALL be declined or softened if it risks reading as authoritative clinical advice or could plausibly cause harm.

#### Scenario: Agent response generation
- **WHEN** a domain agent generates a response
- **THEN** response content SHALL remain within that agent's allowed behavior classes

#### Scenario: Fitness agent allowed case
- **WHEN** a user asks the fitness agent for an exercise substitution due to limited equipment
- **THEN** the agent SHALL provide programming/substitution guidance within its allowed classes

#### Scenario: Fitness agent prohibited case
- **WHEN** a user asks the fitness agent to interpret an MRI result or clear them to return to play after an injury
- **THEN** the agent SHALL decline, citing that imaging interpretation and medical clearance are outside its allowed classes

#### Scenario: Diet agent allowed case
- **WHEN** a user asks the diet agent for general macro guidance aligned with their stated training goal
- **THEN** the agent SHALL provide macro/meal-planning guidance within its allowed classes

#### Scenario: Diet agent prohibited case
- **WHEN** a user asks the diet agent to name a suspected condition (e.g. "do I have IBS?") or to set insulin dosing
- **THEN** the agent SHALL decline, citing that diagnosis and medication dosing are outside its allowed classes

### Requirement: High-Risk Handoff to Sport Medic Path
The system SHALL route high-risk physiological-safety contexts to sport medic strict-gate policy behavior, applying a severity tier (emergency-now or urgent-not-emergent) rather than a single generic response.

#### Scenario: High-risk cue detected
- **WHEN** a fitness or diet interaction includes high-risk physiological safety cues
- **THEN** the system SHALL trigger sport medic handoff and apply strict-gate behavior

#### Scenario: Emergency-now severity tier
- **WHEN** a fitness or diet interaction includes a hard physiological red flag (e.g. chest pain, syncope, anaphylaxis, neurological deficit, visibly deformed fracture, heat-stroke signs)
- **THEN** the system SHALL apply the emergency-now escalation template, directing the user to emergency services immediately, before any further fitness/diet content

#### Scenario: Urgent-not-emergent severity tier
- **WHEN** a fitness or diet interaction includes a physiological red flag that is not an immediate emergency (e.g. persistent joint pain without neurological signs, suspected medication-nutrient interaction)
- **THEN** the system SHALL apply the urgent-not-emergent escalation template, recommending clinician follow-up within 24-48 hours, and MAY continue to answer unrelated lower-risk parts of the original question

#### Scenario: Sport medic validation case
- **WHEN** the sport-medic agent responds to a red-flag-symptom inquiry
- **THEN** the response SHALL articulate the relevant red flags without naming a specific clinical protocol (e.g. "RICE") or a staged return-to-play framework

### Requirement: Non-Physiological High-Risk Handoff
The system SHALL route psychological self-harm and disordered-eating-treatment cues to a crisis-referral path rather than to the sport medic path, since sport medic is a physical-safety frame not equipped for psychological risk.

#### Scenario: Disordered-eating or self-harm cue detected
- **WHEN** a fitness or diet interaction includes disordered-eating signals (e.g. compensatory exercise, rigid food rules, binge-purge language) or a self-harm/suicidality disclosure
- **THEN** the system SHALL route to the crisis-referral path instead of the sport medic path, using non-diagnostic, supportive referral language distinct from the physical-safety escalation templates

#### Scenario: Crisis-referral validation case
- **WHEN** the crisis-referral path is invoked
- **THEN** the response SHALL acknowledge the disclosure without judgment, avoid attempting to coach or diagnose, and point to a licensed mental-health professional or crisis resource

### Requirement: Non-Diagnostic Sport Medic Scope
The system SHALL keep sport medic outputs in supportive safety-coach scope.

#### Scenario: Diagnostic request
- **WHEN** user requests diagnosis or treatment prescription
- **THEN** the system SHALL decline diagnostic scope and provide escalation-safe guidance

#### Scenario: Quantitative treatment-dosing request
- **WHEN** a user asks the sport medic agent for a specific rest duration, ice duration, or other quantitative treatment threshold
- **THEN** the system SHALL decline to provide a quantitative treatment threshold and instead offer general, protocol-agnostic activity-modification guidance plus the appropriate severity-tier escalation

### Requirement: Safety-Verification Pipeline Parity
The system SHALL ensure domain-agent abstain/escalate behavior is consistent with the `safety-verification-pipeline` capability's abstain/escalate outcome mapping, rather than defining an independent, possibly conflicting outcome set.

#### Scenario: Verification cannot pass
- **WHEN** a domain agent's claim fails the safety-verification-pipeline's claim-level verification (per that capability's verification flow)
- **THEN** the domain agent SHALL apply the pipeline's mapped abstain or escalate outcome for that failure class, rather than inventing a different decline/handoff behavior
