Introduction
============

DEXPI e.V. (Data EXchange in the Process Industry) is an association under German law.

Motivation for DEXPI
--------------------

Due to the lack of interoperability between CAE [#f1]_ (and other) systems, companies today
face high efforts in data exchange while working together to execute projects
for planning, construction and operation of process plants. Parties typically
exchanging data in such projects are e.g. EP/EPCs [#f2]_, owner-operators, and
vendors, but also site services and authorities. One of the main reasons for
this high effort is the lack of an agreed understanding across the different
systems, e.g. by means of a commonly used standard for data exchange in the
process industry. To become more efficient during planning, construction and
operation of plants, a data exchange model based on the ISO 15926 standard was
established.

Objectives
----------

The objective is to develop and promote a general method for data exchange,
data interoperability and data integration for the process industry covering all
phases of the lifecycle of a (petro-)chemical plant, ranging from specification
of functional requirements to assets in operation. This method shall cover
formats and content to address various problems seen today:

- Avoid format conversions (and thereby data loss) when passing engineering data
  and documents across CAE system boundaries.

- Make handover of engineering data during and at the end of a project easy and cost-effective.

- Reduce data exchange barriers between different CAE systems or different customizations of the same CAE systems.

- Support long-term storage of plant data in a CAE system independent format. Today’s commonly used standard formats like the non data-centric PDF don’t support value added improvements (or at best insufficiently).

- Simplify co-existence of different CAE systems within a company, e.g. due to mergers/acquisitions or different priorities in different business units.

Expectations
------------

EP/EPCs, suppliers, and owner operators want to minimize the cost for handling engineering data during
planning, construction and operation of process plants between different CAE systems and they want to
create opportunities for new value-added functions based on the available engineering data. Therefore
the CAE vendors will implement a valid global standard for data exchange into their CAE systems.

The involved parties from DEXPI e.V. have defined a common data model which is based on the ISO 15926 standard.
The resulting data model, as reflected in this specification, is aligned with other projects in the global
ISO 15926 community. The CAE vendors will implement this common data model as the basis for data exchange
and will deliver it as part of their default system configuration.

With the information model of the DEXPI 2.0 specification the information included in block flow diagrams
(BFD, process model), process flow diagrams (PFD, process model), and piping and instrumentation diagrams
(P&IDs [#f3]_, plant model) can be represented. Objective of the first phase of the initiative was the transfer of a
P&ID from one P&ID system to another P&ID system. The data transfer must include graphics, symbols, topology,
all engineering attributes, enumerations, select lists etc. to enable seamless continuation of work on the
P&ID in the destination system. With DEXPI 2.0, the process model is included and combined in the same
specification as the plant model, now also enabling the transfer of process related information
(as represented on BFDs and PFDs), including simulation results (like stream tables).


.. rubric:: Footnotes

.. [#f1] CAE: Computer Aided Engineering
.. [#f2] EPC: Engineering-Procurement-Construction
.. [#f3] P&ID: Piping and Instrumentation Diagram
